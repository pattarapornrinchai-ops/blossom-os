'use client'
import { useEffect, useState } from 'react'
import { supabase, getClinicBySlug, getTreatments, createBooking } from '../../../lib/supabase'

const TIMES = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
]

async function getDoctors(clinicId) {
  const { data, error } = await supabase
    .from('doctors')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('is_active', true)
    .order('created_at')
  if (error) throw error
  return data
}

export default function BookingPage({ params }) {
  const { slug } = params
  const [clinic, setClinic] = useState(null)
  const [treatments, setTreatments] = useState([])
  const [doctors, setDoctors] = useState([])
  const [step, setStep] = useState(1)
  const [selectedTreatments, setSelectedTreatments] = useState([])
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [filterTag, setFilterTag] = useState('all')
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
        const [t, d] = await Promise.all([getTreatments(c.id), getDoctors(c.id)])
        setTreatments(t)
        setDoctors(d)
      } catch (e) {
        setError('ไม่พบคลินิกนี้')
      }
    }
    load()
  }, [slug])

  const minDate = new Date()
  minDate.setDate(minDate.getDate() + 1)
  const minDateStr = minDate.toISOString().split('T')[0]

  const allTags = ['all', ...new Set(treatments.map(t => t.tag).filter(Boolean))]
  const filteredTreatments = filterTag === 'all'
    ? treatments
    : treatments.filter(t => t.tag === filterTag)

  function toggleTreatment(t) {
    setSelectedTreatments(prev =>
      prev.find(s => s.id === t.id)
        ? prev.filter(s => s.id !== t.id)
        : [...prev, t]
    )
  }

  const totalPrice = selectedTreatments.reduce((sum, t) => sum + (t.discount_price || t.price), 0)
  const totalDuration = selectedTreatments.reduce((sum, t) => sum + (t.duration_min || 0), 0)

  async function handleSubmit() {
    if (!form.name || !form.phone || !date || !time || selectedTreatments.length === 0) {
      setError('กรุณากรอกข้อมูลให้ครบ')
      return
    }
    setLoading(true)
    setError('')
    try {
      const firstTreatment = selectedTreatments[0]
      const booking = await createBooking({
        clinic_id: clinic.id,
        treatment_id: firstTreatment.id,
        treatment_ids: selectedTreatments.map(t => t.id),
        treatment_names: selectedTreatments.map(t => t.name).join(', '),
        doctor_id: selectedDoctor?.id || null,
        doctor_name: selectedDoctor?.name || null,
        patient_name: form.name,
        phone: form.phone,
        line_id: form.line_id,
        booked_date: date,
        booked_time: time,
        note: form.note,
        total_price: totalPrice,
        status: 'pending',
      })
      setBookingId(booking.id.slice(0, 8).toUpperCase())

      if (clinic.line_token) {
        await fetch('/api/line-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lineToken: clinic.line_token,
            clinicName: clinic.name,
            treatment: selectedTreatments.map(t => t.name).join(', '),
            doctorName: selectedDoctor?.name || null,
            patientName: form.name,
            phone: form.phone,
            lineId: form.line_id,
            date,
            time,
            note: form.note,
            totalPrice,
            bookingId: booking.id.slice(0, 8).toUpperCase(),
          }),
        })
      }
      setStep(3)
    } catch (e) {
      console.error(e)
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง')
    }
    setLoading(false)
  }

  if (error && !clinic) {
    return (
      <div style={s.page}>
        <div style={s.errorBox}><p>⚠️ {error}</p></div>
      </div>
    )
  }

  if (!clinic) {
    return <div style={s.page}><div style={s.loader}>กำลังโหลด...</div></div>
  }

  return (
    <div style={s.page}>
      <div style={s.header}>
        {clinic.logo_url && <img src={clinic.logo_url} alt={clinic.name} style={s.logo} />}
        <h1 style={s.clinicName}>{clinic.name}</h1>
        <p style={s.clinicSub}>จองคิวออนไลน์</p>
      </div>

      {step < 3 && (
        <div style={s.steps}>
          {['เลือกหัตถการ', 'ข้อมูลการจอง', 'ยืนยัน'].map((label, i) => (
            <div key={i} style={s.stepItem}>
              <div style={{
                ...s.stepDot,
                background: step > i ? '#e8748a' : step === i + 1 ? '#e8748a' : '#e5e7eb',
                color: step >= i + 1 ? '#fff' : '#9ca3af',
              }}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span style={{ ...s.stepLabel, color: step === i + 1 ? '#e8748a' : '#9ca3af', fontWeight: step === i + 1 ? 600 : 400 }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      )}

      {step === 1 && (
        <div style={s.section}>
          <h2 style={s.sectionTitle}>เลือกหัตถการ</h2>
          <p style={s.hint}>เลือกได้มากกว่า 1 รายการ</p>

          {allTags.length > 1 && (
            <div style={s.tagRow}>
              {allTags.map(tag => (
                <button key={tag} onClick={() => setFilterTag(tag)} style={{
                  ...s.tagBtn,
                  background: filterTag === tag ? '#e8748a' : '#fdf2f4',
                  color: filterTag === tag ? '#fff' : '#e8748a',
                  border: `1.5px solid ${filterTag === tag ? '#e8748a' : '#f3e8eb'}`,
                }}>
                  {tag === 'all' ? 'ทั้งหมด' : tag}
                </button>
              ))}
            </div>
          )}

          <div style={s.treatGrid}>
            {filteredTreatments.map(t => {
              const isSelected = selectedTreatments.find(s => s.id === t.id)
              return (
                <div key={t.id} onClick={() => toggleTreatment(t)} style={{
                  ...s.treatCard,
                  border: isSelected ? '2px solid #e8748a' : '1.5px solid #f3e8eb',
                  boxShadow: isSelected ? '0 0 0 3px #fce4ec' : 'none',
                }}>
                  <div style={{ ...s.checkBadge, opacity: isSelected ? 1 : 0 }}>✓</div>
                  {t.image_url ? (
                    <img src={t.image_url} alt={t.name} style={s.treatImg} />
                  ) : (
                    <div style={s.treatImgPlaceholder}>✨</div>
                  )}
                  <div style={s.treatBody}>
                    {t.tag && <span style={s.treatTag}>{t.tag}</span>}
                    <p style={s.treatName}>{t.name}</p>
                    {t.description && <p style={s.treatDesc}>{t.description}</p>}
                    <div style={s.priceRow}>
                      {t.discount_price ? (
                        <>
                          <span style={s.oldPrice}>฿{t.price.toLocaleString()}</span>
                          <span style={s.newPrice}>฿{t.discount_price.toLocaleString()}</span>
                        </>
                      ) : (
                        <span style={s.newPrice}>฿{t.price.toLocaleString()}</span>
                      )}
                      {t.duration_min && <span style={s.dur}>⏱ {t.duration_min} น.</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {doctors.length > 0 && (
            <>
              <h2 style={{ ...s.sectionTitle, marginTop: 28 }}>เลือกแพทย์ / ผู้ให้บริการ</h2>
              <p style={s.hint}>ไม่บังคับ — ถ้าไม่เลือก คลินิกจะจัดให้</p>
              <div style={s.doctorGrid}>
                <div onClick={() => setSelectedDoctor(null)} style={{
                  ...s.doctorCard,
                  border: !selectedDoctor ? '2px solid #e8748a' : '1.5px solid #f3e8eb',
                  background: !selectedDoctor ? '#fce4ec' : '#fff',
                }}>
                  <div style={s.doctorAvatar}>🌸</div>
                  <p style={s.doctorName}>ไม่ระบุ</p>
                  <p style={s.doctorSub}>คลินิกจัดให้</p>
                </div>
                {doctors.map(d => (
                  <div key={d.id} onClick={() => setSelectedDoctor(d)} style={{
                    ...s.doctorCard,
                    border: selectedDoctor?.id === d.id ? '2px solid #e8748a' : '1.5px solid #f3e8eb',
                    background: selectedDoctor?.id === d.id ? '#fce4ec' : '#fff',
                  }}>
                    {d.photo_url ? (
                      <img src={d.photo_url} alt={d.name} style={s.doctorPhoto} />
                    ) : (
                      <div style={s.doctorAvatar}>👩‍⚕️</div>
                    )}
                    <p style={s.doctorName}>{d.name}</p>
                    {d.specialty && <p style={s.doctorSub}>{d.specialty}</p>}
                  </div>
                ))}
              </div>
            </>
          )}

          {selectedTreatments.length > 0 && (
            <div style={s.cartBar}>
              <div>
                <p style={s.cartCount}>{selectedTreatments.length} รายการ · {totalDuration} นาที</p>
                <p style={s.cartTotal}>฿{totalPrice.toLocaleString()}</p>
              </div>
              <button onClick={() => setStep(2)} style={s.cartBtn}>ถัดไป →</button>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div style={s.section}>
          <div style={s.summaryBox}>
            <div style={{ flex: 1 }}>
              <p style={s.summaryLabel}>หัตถการที่เลือก</p>
              {selectedTreatments.map(t => (
                <p key={t.id} style={s.summaryItem}>
                  · {t.name} <span style={{ color: '#e8748a' }}>฿{(t.discount_price || t.price).toLocaleString()}</span>
                </p>
              ))}
              {selectedDoctor && (
                <p style={{ ...s.summaryItem, marginTop: 6 }}>👩‍⚕️ {selectedDoctor.name}</p>
              )}
              <p style={s.summaryTotalLine}>รวม ฿{totalPrice.toLocaleString()} · {totalDuration} นาที</p>
            </div>
            <button onClick={() => setStep(1)} style={s.changeBtn}>เปลี่ยน</button>
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>📅 วันที่</label>
            <input type="date" min={minDateStr} value={date} onChange={e => setDate(e.target.value)} style={s.input} />
          </div>

          <div style={s.formGroup}>
            <label style={s.label}>🕐 เวลา</label>
            <div style={s.timeGrid}>
              {TIMES.map(t => (
                <button key={t} onClick={() => setTime(t)} style={{
                  ...s.timeBtn,
                  background: time === t ? '#e8748a' : '#fdf2f4',
                  color: time === t ? '#fff' : '#e8748a',
                  border: `1.5px solid ${time === t ? '#e8748a' : '#f3e8eb'}`,
                }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <h2 style={{ ...s.sectionTitle, marginTop: 24 }}>ข้อมูลผู้จอง</h2>
          <div style={s.formGroup}>
            <label style={s.label}>ชื่อ-นามสกุล *</label>
            <input type="text" placeholder="สมหญิง ใจดี" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} style={s.input} />
          </div>
          <div style={s.formGroup}>
            <label style={s.label}>เบอร์โทรศัพท์ *</label>
            <input type="tel" placeholder="08X-XXX-XXXX" value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })} style={s.input} />
          </div>
          <div style={s.formGroup}>
            <label style={s.label}>LINE ID (ไม่บังคับ)</label>
            <input type="text" placeholder="@lineid" value={form.line_id}
              onChange={e => setForm({ ...form, line_id: e.target.value })} style={s.input} />
          </div>
          <div style={s.formGroup}>
            <label style={s.label}>หมายเหตุ / ข้อมูลสำหรับแพทย์</label>
            <textarea placeholder="แพ้ยา, โรคประจำตัว, ต้องการปรึกษาก่อนทำ..." value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })}
              rows={3} style={{ ...s.input, resize: 'vertical' }} />
          </div>

          {error && <p style={s.errorText}>{error}</p>}

          <button onClick={handleSubmit} disabled={loading}
            style={{ ...s.submitBtn, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'กำลังส่ง...' : `✅ ยืนยันการจอง — ฿${totalPrice.toLocaleString()}`}
          </button>
        </div>
      )}

      {step === 3 && (
        <div style={s.successBox}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>🌸</div>
          <h2 style={s.successTitle}>จองสำเร็จแล้วค่ะ!</h2>
          <p style={s.successSub}>ทางคลินิกจะติดต่อยืนยันนัดหมายผ่านไลน์หรือโทรศัพท์อีกครั้ง</p>
          <div style={s.bookingCard}>
            <Row label="หมายเลขการจอง" value={`#${bookingId}`} />
            <Row label="หัตถการ" value={selectedTreatments.map(t => t.name).join(', ')} />
            {selectedDoctor && <Row label="แพทย์" value={selectedDoctor.name} />}
            <Row label="วันที่" value={new Date(date).toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} />
            <Row label="เวลา" value={`${time} น.`} />
            <Row label="รวม" value={`฿${totalPrice.toLocaleString()}`} highlight />
          </div>
          <button onClick={() => { setStep(1); setSelectedTreatments([]); setSelectedDoctor(null); setDate(''); setTime(''); setForm({ name: '', phone: '', line_id: '', note: '' }) }}
            style={s.resetBtn}>
            จองเพิ่มเติม
          </button>
        </div>
      )}

      <div style={s.footer}><p>Powered by Blossom OS</p></div>
    </div>
  )
}

function Row({ label, value, highlight }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f9f0f3' }}>
      <span style={{ fontSize: 13, color: '#9ca3af' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: highlight ? '#e8748a' : '#1f2937', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}

const s = {
  page: { minHeight: '100vh', background: '#fdf8f9', fontFamily: "'Sarabun','Noto Sans Thai',sans-serif", paddingBottom: 80 },
  header: { background: 'linear-gradient(135deg,#fce4ec 0%,#f8bbd9 100%)', padding: '32px 20px 24px', textAlign: 'center' },
  logo: { width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', marginBottom: 12 },
  clinicName: { fontSize: 24, fontWeight: 700, color: '#c2185b', margin: 0 },
  clinicSub: { color: '#e91e8c', margin: '4px 0 0', fontSize: 14 },
  steps: { display: 'flex', justifyContent: 'center', padding: '20px 16px 8px', background: '#fff', borderBottom: '1px solid #f3e8eb' },
  stepItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 },
  stepDot: { width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, transition: 'all 0.3s' },
  stepLabel: { fontSize: 11, textAlign: 'center' },
  section: { maxWidth: 560, margin: '0 auto', padding: '20px 16px' },
  sectionTitle: { fontSize: 18, fontWeight: 700, color: '#c2185b', marginBottom: 4, marginTop: 0 },
  hint: { fontSize: 12, color: '#9ca3af', marginBottom: 14, marginTop: 0 },
  tagRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 },
  tagBtn: { padding: '5px 14px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' },
  treatGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  treatCard: { borderRadius: 16, overflow: 'hidden', cursor: 'pointer', transition: 'all 0.15s', background: '#fff', position: 'relative' },
  checkBadge: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: '#e8748a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, transition: 'opacity 0.15s', zIndex: 1 },
  treatImg: { width: '100%', height: 110, objectFit: 'cover' },
  treatImgPlaceholder: { width: '100%', height: 110, background: '#fce4ec', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 },
  treatBody: { padding: '10px 12px' },
  treatTag: { fontSize: 10, fontWeight: 600, color: '#e91e8c', background: '#fce4ec', padding: '2px 8px', borderRadius: 20, display: 'inline-block', marginBottom: 6 },
  treatName: { fontSize: 13, fontWeight: 700, color: '#1a1a1a', margin: '0 0 4px', lineHeight: 1.4 },
  treatDesc: { fontSize: 11, color: '#6b7280', margin: '0 0 6px', lineHeight: 1.4 },
  priceRow: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  oldPrice: { fontSize: 11, color: '#9ca3af', textDecoration: 'line-through' },
  newPrice: { fontSize: 14, fontWeight: 700, color: '#c2185b' },
  dur: { fontSize: 10, color: '#9ca3af', marginLeft: 'auto' },
  doctorGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginTop: 4 },
  doctorCard: { borderRadius: 14, padding: '14px 8px', textAlign: 'center', cursor: 'pointer', transition: 'all 0.15s' },
  doctorAvatar: { fontSize: 32, marginBottom: 8 },
  doctorPhoto: { width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', marginBottom: 8 },
  doctorName: { fontSize: 12, fontWeight: 700, color: '#1a1a1a', margin: '0 0 2px' },
  doctorSub: { fontSize: 10, color: '#9ca3af', margin: 0 },
  cartBar: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#e8748a', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100 },
  cartCount: { color: 'rgba(255,255,255,0.85)', fontSize: 12, margin: 0 },
  cartTotal: { color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 },
  cartBtn: { background: '#fff', color: '#e8748a', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  summaryBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: '#fce4ec', borderRadius: 12, padding: '14px 16px', marginBottom: 20 },
  summaryLabel: { fontSize: 11, color: '#e91e8c', margin: '0 0 4px' },
  summaryItem: { fontSize: 13, color: '#374151', margin: '0 0 2px' },
  summaryTotalLine: { fontSize: 14, fontWeight: 700, color: '#c2185b', marginTop: 6, marginBottom: 0 },
  changeBtn: { background: 'transparent', border: '1.5px solid #e91e8c', color: '#e91e8c', borderRadius: 8, padding: '6px 14px', fontSize: 13, cursor: 'pointer', flexShrink: 0, marginLeft: 12 },
  formGroup: { marginBottom: 16 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input: { width: '100%', boxSizing: 'border-box', border: '1.5px solid #f3e8eb', borderRadius: 10, padding: '10px 12px', fontSize: 15, fontFamily: 'inherit', outline: 'none', background: '#fff' },
  timeGrid: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 },
  timeBtn: { padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' },
  submitBtn: { width: '100%', padding: 14, borderRadius: 12, background: '#e8748a', color: '#fff', fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 8 },
  errorText: { color: '#ef4444', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  successBox: { maxWidth: 420, margin: '40px auto 0', padding: '0 16px', textAlign: 'center' },
  successTitle: { fontSize: 22, fontWeight: 700, color: '#c2185b', margin: '0 0 8px' },
  successSub: { color: '#6b7280', fontSize: 14, marginBottom: 24, lineHeight: 1.6 },
  bookingCard: { background: '#fff', borderRadius: 16, padding: 20, textAlign: 'left', border: '1.5px solid #f3e8eb', marginBottom: 24 },
  resetBtn: { background: '#fce4ec', color: '#c2185b', border: 'none', borderRadius: 12, padding: '12px 32px', fontSize: 15, fontWeight: 700, cursor: 'pointer' },
  errorBox: { maxWidth: 400, margin: '60px auto', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, padding: 24, textAlign: 'center', color: '#dc2626' },
  loader: { textAlign: 'center', padding: 80, color: '#e91e8c', fontSize: 16 },
  footer: { textAlign: 'center', color: '#d1d5db', fontSize: 11, marginTop: 40 },
}
