/* eslint-disable no-invalid-this */
const { formatTimestamp, parseDateString } = require('./utils/utils')
const { getAllAccounts } = require('./modules/accounts')

// Firebase
const { onRequest } = require('firebase-functions/v2/https')
// const logger = require('firebase-functions/logger')
// const { onDocumentCreated } = require('firebase-functions/v2/firestore')

const admin = require('firebase-admin')
const { getFirestore } = require('firebase-admin/firestore')
const { setGlobalOptions } = require('firebase-functions/v2')

admin.initializeApp({ credential: admin.credential.applicationDefault() })
setGlobalOptions({ maxInstances: 10 })

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
      const { createdAt, sender, receiver, content, image } = messageData
      if (sender === currentAccount || receiver === currentAccount) {
        const pairKey = [sender, receiver].sort().join('_')
        if (!data[pairKey] || createdAt.toDate() > parseDateString(data[pairKey].createdAt)) {
          data[pairKey] = {
            id: message.id,
            createdAt: formatTimestamp(createdAt),
            sender,
            receiver,
            content,
            image,
            name:
              sender !== currentAccount
                ? accounts.find((account) => account.email === sender).displayName
                : accounts.find((account) => account.email === receiver).displayName
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
