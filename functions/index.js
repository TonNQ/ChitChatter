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

exports.getAllContacts = onRequest(async (req, res) => {
  const email = req.query.email
  try {
    const currentAccount = await getFirestore().collection('accounts').doc(email).get()

    if (!currentAccount.exists) {
      return res.status(404).json({ success: false, data: null, error: 'Tài khoản không tồn tại' })
    }

    const contacts = currentAccount.data().contacts
    res.json({ success: true, data: { contacts }, error: null })
  } catch (error) {
    console.error('Error fetching account:', error)
    res.status(500).json({ success: false, data: null, error: 'Internal server error' })
  }
})

exports.getInfomationOfUser = onRequest(async (req, res) => {
  const email = req.query.email
  try {
    const account = await getFirestore().collection('accounts').doc(email).get()

    if (!account.exists) {
      return res.status(404).json({ success: false, data: null, error: 'Tài khoản không tồn tại' })
    }

    const data = account.data()
    res.json({ success: true, data, error: null })
  } catch (error) {
    console.error('Error fetching account:', error)
    res.status(500).json({ success: false, data: null, error: 'Internal server error' })
  }
})

