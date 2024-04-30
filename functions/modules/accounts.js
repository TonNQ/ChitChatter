const { getFirestore } = require('firebase-admin/firestore')

const getAllAccounts = async function () {
  const accounts = await getFirestore().collection('accounts').get()
  const data = []
  accounts.forEach((account) => {
    data.push(account.data())
  })
  return data
}

module.exports = {
  getAllAccounts
}
