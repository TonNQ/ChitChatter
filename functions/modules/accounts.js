const { getFirestore } = require('firebase-admin/firestore')

const getAllAccounts = async function () {
  const accounts = await getFirestore().collection('accounts').get()
  const data = []
  accounts.forEach((account) => {
    data.push(account.data())
  })
  return data
}

const getAccountInformationByEmail = async function (email) {
  const account = await getFirestore().collection('accounts').doc(email).get()
  return account.data()
}

module.exports = {
  getAllAccounts,
  getAccountInformationByEmail
}
