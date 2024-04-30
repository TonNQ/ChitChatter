/* eslint-disable require-jsdoc */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp._seconds * 1000 + timestamp._nanoseconds / 1000000)

  const year = date.getFullYear()
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const hours = (date.getHours() + 7) % 24
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const seconds = date.getSeconds().toString().padStart(2, '0')

  // Định dạng lại thời gian để có dạng DD/MM/YYYY HH:MM:SS
  const formattedTime = `${day}/${month}/${year} ${hours.toString().padStart(2, '0')}:${minutes}:${seconds}`

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

module.exports = {
  formatTimestamp,
  parseDateString
}
