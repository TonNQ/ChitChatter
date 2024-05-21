/* eslint-disable import/default */
/* eslint-disable require-jsdoc */
/* eslint-disable no-invalid-this */
const { formatTimestamp, parseDateString, displayTime } = require('./utils/utils')
const { getAllAccounts } = require('./modules/accounts')

// Firebase
const { onRequest } = require('firebase-functions/v2/https')

const admin = require('firebase-admin')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, Filter } = require('firebase-admin/firestore')
const { setGlobalOptions } = require('firebase-functions/v2')

admin.initializeApp({ credential: admin.credential.applicationDefault() })
setGlobalOptions({ maxInstances: 10 })

const firestore = admin.firestore()
firestore.settings({ ignoreUndefinedProperties: true })

const { getDatabase, ref, set } = require('firebase/database')
const { initializeApp } = require('firebase/app')

const firebaseConfig = {
  apiKey: 'AIzaSyCS8iWccA0Vh0IWgirTxRzWYR8f3XDOCWo',
  authDomain: 'chitchatter-b97bf.firebaseapp.com',
  databaseURL: 'https://chitchatter-b97bf-default-rtdb.firebaseio.com',
  projectId: 'chitchatter-b97bf',
  storageBucket: 'chitchatter-b97bf.appspot.com',
  messagingSenderId: '32426056104',
  appId: '1:32426056104:web:58f3f2630f4a92b113659d',
  measurementId: 'G-XFNPG8PBTC'
}

const app = initializeApp(firebaseConfig)
const firebaseDb = getDatabase(app)

exports.createAccountInFirestore = onRequest(async (req, res) => {
  const account = req.body
  const collectionRef = getFirestore().collection('accounts')

  await collectionRef
    .doc(account.email)
    .get() // check if account existed
    .then((result) => {
      if (!result.exists) {
        // Add account if not existed
        collectionRef.doc(account.email).set(account)
        updateToken(account.email, account.token)
        res.json({
          success: true,
          targetAccount: account,
          error: null
        })
      } else {
        res.json({
          success: false,
          targetAccount: null,
          error: 'Email đã tồn tại!'
        })
      }
    })
    .catch(() => {
      res.json({
        success: false,
        targetAccount: null,
        error: 'Có lỗi xảy ra trong khi đăng ký tài khoản của bạn!'
      })
    })
})

exports.getCurrentAccount = onRequest(async (req, res) => {
  const account = req.body

  try {
    const authResult = await getAuth().getUserByEmail(account.email)
    // Nếu tài khoản tồn tại, thì kiểm tra mật khẩu và lấy dữ liệu về account
    const docRef = getFirestore().collection('accounts').doc(account.email)

    await docRef
      .get()
      .then((result) => {
        if (result.exists) {
          const targetAccount = result.data()
          updateToken(account.email, account.token)
          targetAccount.token = account.token
          delete targetAccount.password
          res.json(targetAccount)
        } else {
          // Có trong authentication nhưng không có trong firestore -> Xóa trong authentication đi
          getAuth().deleteUser(authResult.uid)
          res.json(null)
        }
      })
      .catch(() => {
        res.json(null)
      })
  } catch (error) {
    res.json(null)
  }
})

exports.updateAccount = onRequest(async (req, res) => {
  const account = req.body
  const collectionRef = getFirestore().collection('accounts')

  await collectionRef
    .doc(account.email)
    .update({
      displayName: account.displayName,
      age: account.age
    })
    .then((result) => {
      collectionRef.doc(account.email).set(account)
      updateToken(account.email, account.token)
      res.json({
        success: true,
        error: null
      })
    })
    .catch(() => {
      res.json({
        success: false,
        error: `Tài khoản với email "${account.email}" không tồn tại!`
      })
    })
})

/**
 * @param {string} username id needed to get account
 * @param {string} token token to update
 */

async function updateToken(email, token) {
  const timestamp = Math.floor(Date.now() / 1000)
  const tokenObject = {
    token: token,
    timestamp: timestamp
  }
  await getFirestore().collection('tokens').doc(email).set(tokenObject)
}

exports.addMessage = onRequest(async (req, res) => {
  const msg = req.query.text
  const result = await getFirestore().collection('messages').add({ message: msg })
  res.json({ result: `MessageId: ${result.id}` })
})

const sendMessageToRealtimeDb = async (message) => {
  try {
    // Extract username from sender and receiver emails
    const senderUsername = message.sender.split('@')[0]
    const receiverUsername = message.receiver.split('@')[0]

    // Sanitize extracted usernames for Firebase paths
    const sanitizedSender = senderUsername
    const sanitizedReceiver = receiverUsername

    // Construct the path for the message
    const messagePath = `messages/${sanitizedSender}/${sanitizedReceiver}`

    // Reference to the database path
    const dbRef = ref(firebaseDb, messagePath)

    // Write the message to the Realtime Database
    await set(dbRef, message)
    console.log('Data written successfully')
  } catch (error) {
    console.error('Error writing data: ', error)
  }
}

exports.sendMessage = onRequest(async (req, res) => {
  let isSent = false
  try {
    const data = req.body
    const isTokenValid = await checkToken(data.sender, data.token)
    if (isTokenValid) {
      const message = {
        content: data.content || null,
        sender: data.sender || null,
        receiver: data.receiver || null,
        photoUrl: data.photoUrl || null,
        photoMimeType: data.photoMimeType || null,
        createdAt: new Date(),
        status: 1
      }

      // Kiểm tra các trường bắt buộc
      if (!message.content || !message.sender || !message.receiver) {
        res.status(400).json({ success: false, data: null, error: 'Thiếu các trường bắt buộc' })
        return
      }

      console.log('Constructed message:', message)

      // Lưu tin nhắn vào Firestore
      await getFirestore().collection('messages').add(message)
      message.createdAt = formatTimestamp(new Date(message.createdAt))

      // Trả về mã trạng thái 200 trước khi gửi thông báo
      res.status(200).json({ success: true, data: message, error: null })
      isSent = true

      // Lấy các token FCM của người nhận
      const receiverDoc = await getFirestore().collection('accounts').doc(message.receiver).get()
      if (!receiverDoc.exists) {
        console.error('Người nhận không tồn tại')
        res.status(400).json({ success: false, data: null, error: 'Người nhận không tồn tại' })
        return
      }

      const receiverData = receiverDoc.data()
      const fcmTokens = receiverData.tokens || []

      const isOnline = fcmTokens.some((token) => {
        return typeof token.token === 'string' && token.token.trim() !== '' && token.isOnline
      })
      if (isOnline) {
        sendMessageToRealtimeDb(message)
      } else {
        // Loại bỏ các token không hợp lệ
        const validTokens = fcmTokens
          .filter((token) => {
            return typeof token.token === 'string' && token.token.trim() !== '' && !token.isOnline
          })
          .map((token) => token.token)

        console.log(validTokens)
        if (validTokens.length > 0) {
          sendNotification(validTokens, data)
        }
      }
    } else {
      console.log('error token')
      res.status(400).json({ success: false, data: null, error: 'Token không hợp lệ' })
    }
  } catch (error) {
    console.error('Error:', error)
    if (!isSent) {
      res.status(500).json({ success: false, data: null, error: 'Lỗi máy chủ nội bộ' })
    }
  }
})

const sendNotification = async (tokens, data) => {
  try {
    const message = {
      notification: {
        title: 'New message',
        body: data.content
      },
      data: {
        content: String(data.content),
        sender: String(data.sender),
        receiver: String(data.receiver),
        photoUrl: String(data.photoUrl || ''),
        photoMimeType: String(data.photoMimeType || ''),
        createdAt: String(new Date().toISOString()),
        status: String(1)
      },
      tokens: tokens
    }

    await admin.messaging().sendEachForMulticast(message)
    console.log('Notification sent successfully')
  } catch (error) {
    console.error('Error sending multicast message:', error)
  }
}

/**
 * Send notification to user
 * @param {Object} body
 */
// async function sendNotification(body) {
//   const token = body.token
//   const message = {
//     token: token,
//     data: {
//       text: body.data.text,
//       photoUri: body.data.photoUri,
//       photoMimeType: body.data.photoMimeType,
//       sender: body.data.sender,
//       receiver: body.data.receiver
//     },
//     notification: {
//       title: body.notification.title,
//       body: body.notification.body
//     }
//   }
//   admin
//     .messaging()
//     .send(message)
//     .then((response) => {
//       console.log('success', response)
//     })
//     .catch((error) => {
//       console.log('failed', error)
//     })
// }

exports.getAllAccounts = async function () {
  const accounts = await getFirestore().collection('accounts').get()
  const data = []
  accounts.forEach((account) => {
    data.push(account.data())
  })
  return data
}

exports.getChat = onRequest(async (req, res) => {
  const sender = req.query.sender
  const receiver = req.query.receiver
  const messageRef = getFirestore().collection('messages')
  const snapshot = await messageRef
    .where(Filter.or(Filter.where('sender', '==', sender), Filter.where('sender', '==', receiver)))
    .where(Filter.or(Filter.where('receiver', '==', sender), Filter.where('receiver', '==', receiver)))
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get()
  const messages = []
  snapshot.forEach((doc) => {
    const message = doc.data()
    const formattedTime = formatTimestamp(message.createdAt)
    message.formattedTime = formattedTime
    messages.push(message)
  })
  res.json(messages)
})

exports.getAllLastMessages = onRequest(async (req, res) => {
  const currentAccount = req.query.email
  const data = {}
  try {
    const messages = await getFirestore().collection('messages').orderBy('createdAt', 'desc').get()
    const accounts = await getAllAccounts()
    messages.forEach((message) => {
      const messageData = message.data()
      const { createdAt, sender, receiver, content, status } = messageData
      if (sender === currentAccount || receiver === currentAccount) {
        const pairKey = [sender, receiver].sort().join('_')
        if (!data[pairKey] || createdAt.toDate() > parseDateString(data[pairKey].formattedTime)) {
          data[pairKey] = {
            id: message.id,
            formattedTime: displayTime(formatTimestamp(createdAt)),
            sender,
            receiver,
            content,
            status,
            name:
              sender !== currentAccount
                ? accounts.find((account) => account.email === sender).displayName
                : accounts.find((account) => account.email === receiver).displayName,
            isIncoming: sender != currentAccount,
            url:
              sender !== currentAccount
                ? accounts.find((account) => account.email === sender).imageUrl
                : accounts.find((account) => account.email === receiver).imageUrl
          }
        }
      }
    })
    res.json({ success: true, data: Object.values(data), error: null })
  } catch (error) {
    console.error('Error fetching account:', error)
    res.status(500).json({ success: false, data: null, error: 'Internal server error' })
  }
})

async function checkToken(email, token) {
  try {
    const accountDoc = await getFirestore().collection('accounts').doc(email).get()
    if (accountDoc.exists) {
      const tokens = accountDoc.data().tokens
      const tokenObj = tokens.find((tokenObj) => tokenObj.token === token)
      return tokenObj ? true : false
    }
    return false
  } catch (error) {
    console.error('Error in checkToken:', error)
    return false
  }
}
