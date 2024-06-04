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
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { setGlobalOptions } = require('firebase-functions/v2')
const { error } = require('firebase-functions/logger')

admin.initializeApp({ credential: admin.credential.applicationDefault() })
setGlobalOptions({ maxInstances: 10 })

// Tạo enum cho status
const CONTACT_STATUS = {
  CONNECTED: 'CONNECTED',
  RECEIVED: 'RECEIVED', // Đã nhận yêu cầu kết bạn
  REQUESTED: 'REQUESTED', // Đã gửi yêu cầu kết bạn
  UNCONNECTED: 'UNCONNECTED'
}

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
        res.status(200).json({
          success: true,
          targetAccount: account,
          error: null
        })
      } else {
        res.status(200).json({
          success: false,
          targetAccount: null,
          error: 'Email đã tồn tại!'
        })
      }
    })
    .catch(() => {
      res.status(500).json({
        success: false,
        targetAccount: null,
        error: 'Có lỗi xảy ra trong khi đăng ký tài khoản của bạn!'
      })
    })
})

exports.getCurrentAccount = onRequest(async (req, res) => {
  const account = req.body

  try {
    console.log(account.email)
    const authResult = await getAuth().getUserByEmail(account.email)
    // Nếu tài khoản tồn tại, thì kiểm tra mật khẩu và lấy dữ liệu về account
    const docRef = getFirestore().collection('accounts').doc(account.email)
    await docRef
      .get()
      .then((result) => {
        // Nếu tài khoản tồn tại trong firestore
        if (result.exists) {
          console.log('Account found in firestore')
          updateToken(account.email, account.token, true)
          const targetAccount = result.data()
          delete targetAccount.password
          res.status(200).json(targetAccount)
        } else {
          // Có trong authentication nhưng không có trong firestore -> Xóa trong authentication đi
          getAuth().deleteUser(authResult.uid)
          console.log('Account not found in firestore, deleted from authentication')
          res.status(401).json(null)
        }
      })
      .catch(() => {
        console.log('Error while fetching account' + error)
        res.status(401).json(null)
      })
  } catch (error) {
    console.log('Account not found in authentication' + error)
    res.status(401).json(null)
  }
})

exports.getAccountByEmail = onRequest(async (req, res) => {
  const email = req.query.email

  try {
    const docRef = getFirestore().collection('accounts').doc(email)
    await docRef
      .get()
      .then((result) => {
        if (result.exists) {
          console.log('Account found in firestore')
          const targetAccount = result.data()
          res.status(200).json({ success: true, data: targetAccount, error: null })
        } else {
          res.status(404).json({ success: false, data: null, error: 'Tài khoản không tồn tại!' })
        }
      })
      .catch(() => {
        console.log('Error while fetching account' + error)
        res.status(404).json({ success: false, data: null, error: 'Tài khoản không tồn tại!' })
      })
  } catch (error) {
    console.log('Account not found in authentication' + error)
    res.status(500).json({ success: false, data: null, error: 'Lỗi server!' })
  }
})

exports.getContactAccount = onRequest(async (req, res) => {
  const email = req.query.email
  const contactEmail = req.query.contactEmail
  const token = req.query.token

  const isTokenValid = await checkToken(email, token)
  if (!isTokenValid) {
    res.status(401).json({ success: false, error: 'Token is invalid' })
    return
  }

  try {
    const result = await getFirestore().collection('accounts').doc(contactEmail).get()

    if (!result.exists) {
      return res.status(404).json({ success: false, data: null, error: 'Tài khoản không tồn tại!' })
    }
    const targetAccount = result.data()
    const contact = targetAccount.contacts.includes(email)

    if (contact) {
      targetAccount.contactStatus = Object.keys(CONTACT_STATUS).indexOf(CONTACT_STATUS.CONNECTED)
      return res.status(200).json({ success: true, data: targetAccount, error: null })
    }

    const requestContactRef = getFirestore().collection('request-contact').doc(`${email}_${contactEmail}`)
    const requestContact = await requestContactRef.get()
    if (requestContact.exists) {
      targetAccount.contactStatus = Object.keys(CONTACT_STATUS).indexOf(CONTACT_STATUS.REQUESTED)
      return res.status(200).json({ success: true, data: targetAccount, error: null })
    }

    const receivedContactRef = getFirestore().collection('request-contact').doc(`${contactEmail}_${email}`)
    const receivedContact = await receivedContactRef.get()
    if (receivedContact.exists) {
      targetAccount.contactStatus = Object.keys(CONTACT_STATUS).indexOf(CONTACT_STATUS.RECEIVED)
      return res.status(200).json({ success: true, data: targetAccount, error: null })
    }

    targetAccount.contactStatus = Object.keys(CONTACT_STATUS).indexOf(CONTACT_STATUS.UNCONNECTED)
    return res.status(200).json({ success: true, data: targetAccount, error: null })
  } catch (error) {
    console.log('Error while fetching account' + error)
    return res.status(500).json({ success: false, data: null, error: 'Lỗi server!' })
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

async function updateToken(email, token, isOnline) {
  const userRef = getFirestore().collection('accounts').doc(email)
  try {
    await userRef.update({
      tokens: FieldValue.arrayUnion({ token: token, isOnline: isOnline })
    })
    console.log('Token added successfully')
  } catch (error) {
    console.error('Error updating document:', error)
    throw new Error('Failed to add token')
  }
}

exports.logout = onRequest(async (req, res) => {
  const account = req.body
  try {
    // Get the user account
    const userRef = getFirestore().collection('accounts').doc(account.email)
    const userDoc = await userRef.get()
    const userData = userDoc.data()

    // Find the object with the token to remove
    const tokenToRemove = userData.tokens.find((tokenObj) => tokenObj.token === account.token)

    // Remove the object from the tokens array
    if (tokenToRemove) {
      await userRef.update({
        tokens: FieldValue.arrayRemove(tokenToRemove)
      })
    }

    res.status(200).json({ success: true, error: null })
  } catch (error) {
    console.error('Error updating document:', error)
    res.status(500).json({ success: false, error: 'Failed to remove token' })
  }
})

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

exports.getContactsOfAccount = onRequest(async (req, res) => {
  const email = req.query.email
  const token = req.query.token

  try {
    const isTokenValid = await checkToken(email, token)
    if (!isTokenValid) {
      res.status(401).json({ success: false, error: 'Token is invalid' })
      return
    }

    const userDoc = await getFirestore().collection('accounts').doc(email).get()
    const contacts = userDoc.data().contacts

    const data = []
    // Get all contacts unique
    for (const contactEmail of contacts) {
      if (!data.includes(contactEmail)) {
        const contactInfo = await getContactInfo(contactEmail)
        if (contactInfo !== null) {
          data.push({ email: contactEmail, displayName: contactInfo.displayName, imageUrl: contactInfo.imageUrl })
        }
      }
    }
    res.status(200).json({ success: true, data: data, error: null })
  } catch (error) {
    console.error('Error fetching account:', error)
    res.status(500).json({ success: false, data: null, error: 'Internal server error' })
  }
})

exports.searchContacts = onRequest(async (req, res) => {
  const email = req.query.email
  const token = req.query.token
  let searchText = req.query.searchText

  searchText = searchText.replace('@gmail.com', '')
  try {
    const isTokenValid = await checkToken(email, token)
    if (!isTokenValid) {
      res.status(401).json({ success: false, error: 'Token is invalid' })
      return
    }

    // Lấy danh sách contacts của account
    const accountDoc = await getFirestore().collection('accounts').doc(email).get() // Lấy document của account
    const listContacts = accountDoc.data().contacts // Lấy danh sách contacts của account

    // Lấy danh sách request-contact có sender là email
    const requestContacts = await getFirestore().collection('request-contact').where('sender', '==', email).get()
    const listRequests = requestContacts.docs.map((doc) => doc.data().receiver)

    const receivedContacts = await getFirestore().collection('request-contact').where('receiver', '==', email).get()
    const listReceived = receivedContacts.docs.map((doc) => doc.data().sender)

    const listAccounts = [] // Danh sách account tìm được
    // Kiểm tra xem document ID có contains searchText không
    const accounts = await getFirestore().collection('accounts').get()
    accounts.forEach((contact) => {
      const contactData = contact.data()
      // Sử dụng contact.id để lấy ID của document
      const trimmedEmail = contactData.email.replace('@gmail.com', '')
      if (contactData.email !== email && trimmedEmail.toLowerCase().includes(searchText.toLowerCase())) {
        // Xác định quan hệ giữa account và contact
        let contactStatus = CONTACT_STATUS.UNCONNECTED
        if (listContacts.includes(contactData.email)) {
          contactStatus = CONTACT_STATUS.CONNECTED
        } else if (listRequests.includes(contactData.email)) {
          contactStatus = CONTACT_STATUS.REQUESTED
        } else if (listReceived.includes(contactData.email)) {
          contactStatus = CONTACT_STATUS.RECEIVED
        }

        listAccounts.push({
          email: contactData.email,
          displayName: contactData.displayName,
          imageUrl: contactData.imageUrl,
          contactStatus: Object.keys(CONTACT_STATUS).indexOf(contactStatus)
        })
      }
    })

    // sắp xếp listAccounts theo thứ tự enum CONTACT_STATUS
    listAccounts.sort((a, b) => {
      return CONTACT_STATUS[b.status] - CONTACT_STATUS[a.status]
    })
    res.status(200).json({ success: true, data: listAccounts, error: null })
  } catch (error) {
    console.error('Error fetching account:', error)
    res.status(500).json({ success: false, data: null, error: 'Internal server error' })
  }
})

exports.getContactRequests = onRequest(async (req, res) => {
  const email = req.query.email
  const token = req.query.token

  try {
    const isTokenValid = await checkToken(email, token)
    if (!isTokenValid) {
      res.status(401).json({ success: false, error: 'Token is invalid' })
      return
    }

    const requestContacts = await getFirestore().collection('request-contact').where('receiver', '==', email).get()
    const data = []
    requestContacts.forEach((request) => {
      data.push(request.data())
    })
    res.status(200).json({ success: true, data: data, error: null })
  } catch (error) {
    console.error('Error fetching account:', error)
    res.status(500).json({ success: false, data: null, error: 'Internal server error' })
  }
})

async function getContactInfo(email) {
  try {
    const accountDoc = await getFirestore().collection('accounts').doc(email).get()
    if (accountDoc.exists) {
      const account = accountDoc.data()
      return account
    } else {
      return null
    }
  } catch (error) {
    console.error('Error fetching account:', error)
    return null
  }
}

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
