const { onRequest } = require('firebase-functions/v2/https')
// const logger = require('firebase-functions/logger')
// const { onDocumentCreated } = require('firebase-functions/v2/firestore')

const admin = require('firebase-admin')
const { getFirestore } = require('firebase-admin/firestore')
const { setGlobalOptions } = require('firebase-functions/v2')

admin.initializeApp({ credential: admin.credential.applicationDefault() })
setGlobalOptions({ maxInstances: 10 })

exports.addAccount = onRequest(async (req, res) => {
  const account = req.body
  const collectionRef = getFirestore().collection('accounts')

  await collectionRef
    .doc(account.username)
    .get() // check if account existed
    .then((result) => {
      if (!result.exists) {
      // Add account if not existed
        collectionRef
          .doc(account.username).set(account)
        updateToken(account.username, account.token)
        res.json({
          success: true,
          targetAccount: account,
          error: null
        })
      } else {
        res.json({
          success: false,
          targetAccount: null,
          error: 'Username đã tồn tại!'
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

exports.updateAccount = onRequest(async (req, res) => {
  const account = req.body
  const collectionRef = getFirestore().collection('accounts')

  await collectionRef
    .doc(account.username)
    .update({
      displayName: account.displayName,
      email: account.email,
      age: account.age
    })
    .then((result) => {
      collectionRef.doc(account.username).set(account)
      updateToken(account.username, account.token)
      res.json({
        success: true,
        error: null
      })
    })
    .catch(() => {
      res.json({
        success: false,
        error: `Tài khoản với username "${account.username}" không tồn tại!`
      })
    })
})

/**
 * @param {string} username id needed to get account
 * @param {string} token token to update
 */

async function updateToken (username, token) {
  const timestamp = Math.floor(Date.now() / 1000)
  const tokenObject = {
    token: token,
    timestamp: timestamp
  }
  await getFirestore()
    .collection('tokens')
    .doc(username)
    .set(tokenObject)
}

exports.login = onRequest(async (req, res) => {
  const account = req.body
  const docRef = getFirestore()
    .collection('accounts')
    .doc(account.username)

  await docRef
    .get()
    .then((result) => {
      if (result.exists) {
        const targetAccount = result.data()
        if (targetAccount.password === account.password) {
          updateToken(account.username, account.token)
          targetAccount.token = account.token
          res.json(targetAccount)
        } else {
          res.json(null)
        }
      } else {
        res.json(null)
      }
    })
    .catch(() => {
      res.json(null)
    })
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
async function sendNotification (body) {
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
