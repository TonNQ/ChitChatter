/* eslint-disable require-jsdoc */
/* eslint-disable no-invalid-this */
const { formatTimestamp, parseDateString, displayTime } = require('./utils/utils')
const { getAllAccounts } = require('./modules/accounts')

// Firebase
const { onRequest } = require('firebase-functions/v2/https')
// const logger = require('firebase-functions/logger')
// const { onDocumentCreated } = require('firebase-functions/v2/firestore')

const admin = require('firebase-admin')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')
const { setGlobalOptions } = require('firebase-functions/v2')

admin.initializeApp({ credential: admin.credential.applicationDefault() })
setGlobalOptions({ maxInstances: 10 })

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

exports.sendMessage = onRequest(async (req, res) => {
  const message = req.body
  await getFirestore().collection('messages').add(message)
  await sendNotification(message)
  res.json({
    success: true,
    error: null
  })
})

/**
 * Send notification to user
 * @param {Object} body
 */
async function sendNotification(body) {
  const token = body.token
  const message = {
    token: token,
    data: {
      text: body.data.text,
      photoUri: body.data.photoUri,
      photoMimeType: body.data.photoMimeType,
      sender: body.data.sender,
      receiver: body.data.receiver
    },
    notification: {
      title: body.notification.title,
      body: body.notification.body
    }
  }
  admin
    .messaging()
    .send(message)
    .then((response) => {
      console.log('success', response)
    })
    .catch((error) => {
      console.log('failed', error)
    })
}

exports.getAllAccounts = async function () {
  const accounts = await getFirestore().collection('accounts').get()
  const data = []
  accounts.forEach((account) => {
    data.push(account.data())
  })
  return data
}

exports.getAllLastMessages = onRequest(async (req, res) => {
  const currentAccount = req.query.email
  const data = {}
  try {
    const messages = await getFirestore().collection('messages').orderBy('createdAt', 'desc').get()
    const accounts = await getAllAccounts()
    messages.forEach((message) => {
      const messageData = message.data()
      const { createdAt, sender, receiver, content, image, status } = messageData
      if (sender === currentAccount || receiver === currentAccount) {
        const pairKey = [sender, receiver].sort().join('_')
        if (!data[pairKey] || createdAt.toDate() > parseDateString(data[pairKey].formattedTime)) {
          data[pairKey] = {
            id: message.id,
            formattedTime: displayTime(formatTimestamp(createdAt)),
            sender,
            receiver,
            content,
            image,
            status,
            name:
              sender !== currentAccount
                ? accounts.find((account) => account.email === sender).displayName
                : accounts.find((account) => account.email === receiver).displayName,
            isIncoming: sender != currentAccount
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
