/* eslint-disable require-jsdoc */
const moment = require('moment')

// function formatTimestamp(timestamp) {
//   const date = new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000)

//   const year = date.getFullYear()
//   const month = (date.getMonth() + 1).toString().padStart(2, '0')
//   const day = date.getDate().toString().padStart(2, '0')
//   const hours = (date.getHours() + 7) % 24
//   const minutes = date.getMinutes().toString().padStart(2, '0')
//   const seconds = date.getSeconds().toString().padStart(2, '0')

//   // Định dạng lại thời gian để có dạng DD/MM/YYYY HH:MM:SS
//   const formattedTime = `${day}/${month}/${year} ${hours.toString().padStart(2, '0')}:${minutes}:${seconds}`

//   return formattedTime
// }

function formatTimestamp(timestamp) {
  let date

  // Check if the input is a Firestore Timestamp object
  if (timestamp && typeof timestamp === 'object' && '_seconds' in timestamp && '_nanoseconds' in timestamp) {
    date = new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000)
  } else {
    // Assume the input is a JavaScript Date object
    date = new Date(timestamp)
  }
  // Adjust for UTC+7
  date.setHours((date.getHours() + 7) % 24)

  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')

  // Format the date and time as DD/MM/YYYY HH:MM:SS
  const formattedTime = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`

  return formattedTime
}

// Hàm chuyển đổi chuỗi timestamp sang đối tượng Date
function parseDateString(timestamp) {
  const [datePart, timePart] = timestamp.split(' ') // Tách phần ngày và phần giờ
  const [day, month, year] = datePart.split('/') // Tách ngày, tháng, năm
  const [hours, minutes, seconds] = timePart.split(':') // Tách giờ, phút, giây

  // Tạo đối tượng Date từ chuỗi ngày/tháng/năm/giờ/phút/giây
  const date = new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}`)

  return date
}

// 04/05/2024 10:18:14
// kiểm tra xem nếu nó cùng ngày với giờ hiện tại thì in ra giờ dưới dạng như 10:18 AM
// nếu khác ngày thì in ra ngày dưới dạng May 04
function displayTime(time) {
  const dateFormat = 'DD/MM/YYYY HH:mm:ss'

  // Chuyển đổi chuỗi ngày thành đối tượng moment
  const inputDateTime = moment(time, dateFormat)

  // Lấy ngày và giờ hiện tại
  const currentDateTime = moment()

  // So sánh ngày giờ
  if (inputDateTime.isSame(currentDateTime, 'day')) {
    return inputDateTime.format('hh:mm A')
  } else {
    return inputDateTime.format('MMM DD')
  }
}

module.exports = {
  formatTimestamp,
  parseDateString,
  displayTime
}
