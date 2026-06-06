// app/api/line-notify/route.js
// API route สำหรับส่ง LINE แจ้งเตือนไปหาคลินิกเมื่อมีการจอง

export async function POST(request) {
  try {
    const body = await request.json()
    const {
      lineToken,
      clinicName,
      treatment,
      patientName,
      phone,
      lineId,
      date,
      time,
      note,
      bookingId,
    } = body

    // ถ้าคลินิกไม่ได้ตั้งค่า LINE Token ก็ข้ามไปได้
    if (!lineToken) {
      return Response.json({ success: false, reason: 'no_token' })
    }

    // แปลงวันที่เป็นภาษาไทย
    const dateFormatted = new Date(date).toLocaleDateString('th-TH', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    // ข้อความที่จะส่งไปใน LINE
    const message = [
      `🌸 มีการจองใหม่! — ${clinicName}`,
      `─────────────────────`,
      `📋 หมายเลข: #${bookingId}`,
      `💉 หัตถการ: ${treatment}`,
      ``,
      `👤 ลูกค้า: ${patientName}`,
      `📞 โทร: ${phone}`,
      lineId ? `💬 LINE: ${lineId}` : null,
      ``,
      `📅 วันที่: ${dateFormatted}`,
      `🕐 เวลา: ${time} น.`,
      note ? `📝 หมายเหตุ: ${note}` : null,
      `─────────────────────`,
      `👉 เข้า Dashboard เพื่อยืนยันคิว`,
    ]
      .filter(Boolean)
      .join('\n')

    // ส่งผ่าน LINE Messaging API (Push Message ไปหา Group หรือ User)
    // *** ต้องใช้ Channel Access Token จาก LINE Developers Console ***
    const lineRes = await fetch('https://api.line.me/v2/bot/message/broadcast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${lineToken}`,
      },
      body: JSON.stringify({
        messages: [
          {
            type: 'text',
            text: message,
          },
        ],
      }),
    })

    if (!lineRes.ok) {
      const errText = await lineRes.text()
      console.error('LINE API Error:', errText)
      // ไม่ throw เพราะการจองสำเร็จแล้ว แค่แจ้งเตือนไม่ได้
      return Response.json({ success: false, lineError: errText }, { status: 200 })
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('line-notify error:', error)
    return Response.json({ success: false, error: error.message }, { status: 500 })
  }
}
