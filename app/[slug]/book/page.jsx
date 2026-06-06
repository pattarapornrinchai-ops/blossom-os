'use client'
import { useEffect, useState } from 'react'
import { supabase, getClinicBySlug, getTreatments, createBooking } from '../../../lib/supabase'

const TIMES = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
]

export default function BookingPage({ params }) {
  const { slug } = params
  const [clinic, setClinic] = useState(null)
  const [treatments, setTreatments] = useState([])
  const [step, setStep] = useState(1) // 1=เลือก, 2=กรอกฟอร์ม, 3=สำเร็จ
  const [selected, setSelected] = useState(null)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', line_id: '', note: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bookingId, setBookingId] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const c = await getClinicBySlug(slug)
        setClinic(c)
        const t = await getTreatments(c.id)
        setTreatments(t)
      } catch (e) {
        setError('ไม่พบคลินิกนี้')
      }
    }
    load()
  }, [slug])

  // วันที่ขั้นต่ำ = พรุ่งนี้
  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  async function handleSubmit() {
    if (!form.name || !form.phone || !date || !time) {
      setError('กรุณากรอกข้อมูลให้ครบ')
      return
    }
    setLoading(true)
    setError('')
    try {
      const booking = await createBooking({
        clinic_id: clinic.id,
        treatment_id: selected.id,
        patient_name: form.name,
        phone: form.phone,
        line_id: form.line_id,
        booked_date: date,
        booked_time: time,
        note: form.note,
        status: 'pending',
      })
      setBookingId(booking.id.slice(0, 8).toUpperCase())

      // ส่ง LINE แจ้งเตือนคลินิก
      await fetch('/api/line-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineToken: clinic.line_token,
          clinicName: clinic.name,
          treatment: selected.name,
          patientName: form.name,
          phone: form.phone,
          lineId: form.line_id,
          date,
          time,
          note: form.note,
          bookingId: booking.id.slice(0, 8).toUpperCase(),
        }),
      })

      setStep(3)
    } catch (e) {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    }
    setLoading(false)
  }

  if (error && !clinic) {
    return (
      <div style={styles.page}>
        <div style={styles.errorBox}>
          <p>⚠️ {error}</p>
        </div>
      </div>
    )
  }

  if (!clinic) {
    return (
      <div style={styles.page}>
        <div style={styles.loader}>กำลังโหลด...</div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        {clinic.logo_url && (
          <img src={clinic.logo_url} alt={clinic.name} style={styles.logo} />
        )}
        <h1 style={styles.clinicName}>{clinic.name}</h1>
        <p style={styles.clinicSub}>จองคิวออนไลน์</p>
      </div>

      {/* Steps indicator */}
      {step < 3 && (
        <div style={styles.steps}>
          {['เลือกหัตถการ', 'ข้อมูลการจอง', 'ยืนยัน'].map((s, i) => (
            <div key={i} style={styles.stepItem}>
              <div style={{
                ...styles.stepDot,
                background: step > i ? '#e8748a' : step === i + 1 ? '#e8748a' : '#e5e7eb',
                color: step >= i + 1 ? '#fff' : '#9ca3af',
              }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span style={{
                ...styles.stepLabel,
                color: step === i + 1 ? '#e8748a' : '#9ca3af',
                fontWeight: step === i + 1 ? 600 : 400,
              }}>{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* STEP 1: เลือกหัตถการ */}
      {step === 1 && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>เลือกหัตถการ</h2>
          <div style={styles.treatmentGrid}>
            {treatments.map(t => (
              <div
                key={t.id}
                onClick={() => { setSelected(t); setStep(2) }}
                style={{
                  ...styles.treatmentCard,
                  border: selected?.id === t.id
                    ? '2px solid #e8748a'
                    : '1.5px solid #f3e8eb',
                }}
              >
                {t.image_url ? (
                  <img src={t.image_url} alt={t.name} style={styles.treatmentImg} />
                ) : (
                  <div style={styles.treatmentImgPlaceholder}>
                    <span style={{ fontSize: 32 }}>✨</span>
                  </div>
                )}
                <div style={styles.treatmentInfo}>
                  {t.tag && <span style={styles.tag}>{t.tag}</span>}
                  <h3 style={styles.treatmentName}>{t.name}</h3>
                  {t.description && (
                    <p style={styles.treatmentDesc}>{t.description}</p>
                  )}
                  <div style={styles.priceRow}>
                    {t.discount_price ? (
                      <>
                        <span style={styles.originalPrice}>
                          ฿{t.price.toLocaleString()}
                        </span>
                        <span style={styles.discountPrice}>
                          ฿{t.discount_price.toLocaleString()}
                        </span>
                      </>
                    ) : (
                      <span style={styles.price}>฿{t.price.toLocaleString()}</span>
                    )}
                    {t.duration_min && (
                      <span style={styles.duration}>⏱ {t.duration_min} นาที</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 2: ฟอร์มจอง */}
      {step === 2 && selected && (
        <div style={styles.section}>
          {/* สรุปหัตถการที่เลือก */}
          <div style={styles.selectedSummary}>
            <div>
              <p style={styles.summaryLabel}>หัตถการที่เลือก</p>
              <p style={styles.summaryTitle}>{selected.name}</p>
              <p style={styles.summaryPrice}>
                ฿{(selected.discount_price || selected.price).toLocaleString()}
              </p>
            </div>
            <button onClick={() => setStep(1)} style={styles.changeBtn}>
              เปลี่ยน
            </button>
          </div>

          {/* วันและเวลา */}
          <div style={styles.formGroup}>
            <label style={styles.label}>📅 วันที่</label>
            <input
              type="date"
              min={minDateStr}
              value={date}
              onChange={e => setDate(e.target.value)}
              style={styles.input}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>🕐 เวลา</label>
            <div style={styles.timeGrid}>
              {TIMES.map(t => (
                <button
                  key={t}
                  onClick={() => setTime(t)}
                  style={{
                    ...styles.timeBtn,
                    background: time === t ? '#e8748a' : '#fdf2f4',
                    color: time === t ? '#fff' : '#e8748a',
                    border: `1.5px solid ${time === t ? '#e8748a' : '#f3e8eb'}`,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* ข้อมูลผู้จอง */}
          <h2 style={{ ...styles.sectionTitle, marginTop: 24 }}>ข้อมูลผู้จอง</h2>
          <div style={styles.formGroup}>
            <label style={styles.label}>ชื่อ-นามสกุล *</label>
            <input
              type="text"
              placeholder="สมหญิง ใจดี"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              style={styles.input}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>เบอร์โทรศัพท์ *</label>
            <input
              type="tel"
              placeholder="08X-XXX-XXXX"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              style={styles.input}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>LINE ID (ไม่บังคับ)</label>
            <input
              type="text"
              placeholder="@lineid"
              value={form.line_id}
              onChange={e => setForm({ ...form, line_id: e.target.value })}
              style={styles.input}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>หมายเหตุ (ไม่บังคับ)</label>
            <textarea
              placeholder="แพ้ยา, โรคประจำตัว, ข้อมูลเพิ่มเติม..."
              value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })}
              rows={3}
              style={{ ...styles.input, resize: 'vertical' }}
            />
          </div>

          {error && <p style={styles.errorText}>{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              ...styles.submitBtn,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'กำลังส่ง...' : '✅ ยืนยันการจอง'}
          </button>
        </div>
      )}

      {/* STEP 3: สำเร็จ */}
      {step === 3 && (
        <div style={styles.successBox}>
          <div style={styles.successIcon}>🌸</div>
          <h2 style={styles.successTitle}>จองสำเร็จแล้วค่ะ!</h2>
          <p style={styles.successSub}>ทางคลินิกจะติดต่อยืนยันนัดหมายผ่านไลน์หรือโทรศัพท์อีกครั้ง</p>

          <div style={styles.bookingCard}>
            <div style={styles.bookingRow}>
              <span style={styles.bookingLabel}>หมายเลขการจอง</span>
              <span style={styles.bookingValue}>#{bookingId}</span>
            </div>
            <div style={styles.bookingRow}>
              <span style={styles.bookingLabel}>หัตถการ</span>
              <span style={styles.bookingValue}>{selected?.name}</span>
            </div>
            <div style={styles.bookingRow}>
              <span style={styles.bookingLabel}>วันที่</span>
              <span style={styles.bookingValue}>
                {new Date(date).toLocaleDateString('th-TH', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                })}
              </span>
            </div>
            <div style={styles.bookingRow}>
              <span style={styles.bookingLabel}>เวลา</span>
              <span style={styles.bookingValue}>{time} น.</span>
            </div>
          </div>

          <button
            onClick={() => { setStep(1); setSelected(null); setDate(''); setTime(''); setForm({ name: '', phone: '', line_id: '', note: '' }) }}
            style={styles.resetBtn}
          >
            จองเพิ่มเติม
          </button>
        </div>
      )}

      <div style={styles.footer}>
        <p>Powered by Blossom OS</p>
      </div>
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '100vh',
    background: '#fdf8f9',
    fontFamily: "'Sarabun', 'Noto Sans Thai', sans-serif",
    paddingBottom: 48,
  },
  header: {
    background: 'linear-gradient(135deg, #fce4ec 0%, #f8bbd9 100%)',
    padding: '32px 20px 24px',
    textAlign: 'center',
  },
  logo: { width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', marginBottom: 12 },
  clinicName: { fontSize: 24, fontWeight: 700, color: '#c2185b', margin: 0 },
  clinicSub: { color: '#e91e8c', margin: '4px 0 0', fontSize: 14 },
  steps: {
    display: 'flex', justifyContent: 'center', gap: 0,
    padding: '20px 16px 8px', background: '#fff',
    borderBottom: '1px solid #f3e8eb',
  },
  stepItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 },
  stepDot: {
    width: 32, height: 32, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700, transition: 'all 0.3s',
  },
  stepLabel: { fontSize: 11, textAlign: 'center', transition: 'all 0.3s' },
  section: { maxWidth: 520, margin: '0 auto', padding: '20px 16px' },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: '#c2185b', marginBottom: 16, marginTop: 0 },
  treatmentGrid: { display: 'flex', flexDirection: 'column', gap: 12 },
  treatmentCard: {
    display: 'flex', background: '#fff', borderRadius: 16,
    overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.2s',
  },
  treatmentImg: { width: 110, height: 110, objectFit: 'cover', flexShrink: 0 },
  treatmentImgPlaceholder: {
    width: 110, height: 110, flexShrink: 0,
    background: '#fce4ec', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  treatmentInfo: { padding: '12px 14px', flex: 1 },
  tag: {
    fontSize: 11, fontWeight: 600, color: '#e91e8c',
    background: '#fce4ec', padding: '2px 8px', borderRadius: 20,
    display: 'inline-block', marginBottom: 6,
  },
  treatmentName: { fontSize: 15, fontWeight: 700, color: '#1a1a1a', margin: '0 0 4px' },
  treatmentDesc: { fontSize: 12, color: '#6b7280', margin: '0 0 8px', lineHeight: 1.5 },
  priceRow: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  price: { fontSize: 15, fontWeight: 700, color: '#c2185b' },
  discountPrice: { fontSize: 16, fontWeight: 700, color: '#c2185b' },
  originalPrice: { fontSize: 12, color: '#9ca3af', textDecoration: 'line-through' },
  duration: { fontSize: 11, color: '#9ca3af', marginLeft: 'auto' },

  selectedSummary: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#fce4ec', borderRadius: 12, padding: '12px 16px', marginBottom: 20,
  },
  summaryLabel: { fontSize: 11, color: '#e91e8c', margin: '0 0 2px' },
  summaryTitle: { fontSize: 15, fontWeight: 700, color: '#c2185b', margin: '0 0 2px' },
  summaryPrice: { fontSize: 14, fontWeight: 600, color: '#e91e8c', margin: 0 },
  changeBtn: {
    background: 'transparent', border: '1.5px solid #e91e8c',
    color: '#e91e8c', borderRadius: 8, padding: '6px 14px',
    fontSize: 13, cursor: 'pointer',
  },

  formGroup: { marginBottom: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input: {
    width: '100%', boxSizing: 'border-box',
    border: '1.5px solid #f3e8eb', borderRadius: 10,
    padding: '10px 12px', fontSize: 15, fontFamily: 'inherit',
    outline: 'none', background: '#fff',
  },
  timeGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
  },
  timeBtn: {
    padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.15s',
  },
  errorText: { color: '#ef4444', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  submitBtn: {
    width: '100%', padding: '14px', borderRadius: 12,
    background: '#e8748a', color: '#fff', fontSize: 16, fontWeight: 700,
    border: 'none', cursor: 'pointer', marginTop: 8,
  },

  successBox: {
    maxWidth: 420, margin: '40px auto 0', padding: '0 16px', textAlign: 'center',
  },
  successIcon: { fontSize: 64, marginBottom: 12 },
  successTitle: { fontSize: 22, fontWeight: 700, color: '#c2185b', margin: '0 0 8px' },
  successSub: { color: '#6b7280', fontSize: 14, marginBottom: 24, lineHeight: 1.6 },
  bookingCard: {
    background: '#fff', borderRadius: 16, padding: 20, textAlign: 'left',
    border: '1.5px solid #f3e8eb', marginBottom: 24,
  },
  bookingRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 0', borderBottom: '1px solid #f9f0f3',
  },
  bookingLabel: { fontSize: 13, color: '#9ca3af' },
  bookingValue: { fontSize: 14, fontWeight: 600, color: '#1f2937', textAlign: 'right', maxWidth: '60%' },
  resetBtn: {
    background: '#fce4ec', color: '#c2185b', border: 'none',
    borderRadius: 12, padding: '12px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  errorBox: {
    maxWidth: 400, margin: '60px auto', background: '#fef2f2',
    border: '1px solid #fca5a5', borderRadius: 12, padding: 24, textAlign: 'center',
    color: '#dc2626',
  },
  loader: { textAlign: 'center', padding: 80, color: '#e91e8c', fontSize: 16 },
  footer: { textAlign: 'center', color: '#d1d5db', fontSize: 11, marginTop: 40 },
}
