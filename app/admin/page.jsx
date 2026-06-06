'use client'
import { useEffect, useState } from 'react'
import { supabase, signIn, signOut, getSession, getBookings, updateBookingStatus, getTreatments, createTreatment, updateTreatment, deleteTreatment, uploadImage } from '../../lib/supabase'

async function getClinicForUser() {
  const { data: session } = await supabase.auth.getSession()
  if (!session?.session) return null
  const userId = session.session.user.id
  const { data } = await supabase
    .from('clinic_users')
    .select('clinic_id, clinics(*)')
    .eq('id', userId)
    .single()
  return data?.clinics || null
}

async function getDoctors(clinicId) {
  const { data } = await supabase.from('doctors').select('*').eq('clinic_id', clinicId).order('created_at')
  return data || []
}
async function upsertDoctor(doctor) {
  if (doctor.id) {
    const { data, error } = await supabase.from('doctors').update(doctor).eq('id', doctor.id).select().single()
    if (error) throw error; return data
  }
  const { data, error } = await supabase.from('doctors').insert(doctor).select().single()
  if (error) throw error; return data
}
async function deleteDoctor(id) {
  const { error } = await supabase.from('doctors').delete().eq('id', id)
  if (error) throw error
}

const STATUS_LABEL = { pending: 'รอยืนยัน', confirmed: 'ยืนยันแล้ว', cancelled: 'ยกเลิก' }
const STATUS_COLOR = { pending: '#f59e0b', confirmed: '#10b981', cancelled: '#ef4444' }
const STATUS_BG = { pending: '#fffbeb', confirmed: '#f0fdf4', cancelled: '#fef2f2' }

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [loginErr, setLoginErr] = useState('')
  const [loginLoading, setLL] = useState(false)
  const [clinic, setClinic] = useState(null)
  const [tab, setTab] = useState('bookings')
  const [bookings, setBookings] = useState([])
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState('')
  const [treatments, setTreatments] = useState([])
  const [tForm, setTForm] = useState(null)
  const [tLoading, setTLoading] = useState(false)
  const [doctors, setDoctors] = useState([])
  const [dForm, setDForm] = useState(null)

  useEffect(() => {
    getSession().then(sess => {
      if (sess) { setAuthed(true); loadClinic() }
    })
  }, [])

  async function loadClinic() {
    const c = await getClinicForUser()
    if (!c) return
    setClinic(c)
    loadBookings(c.id)
    loadTreatments(c.id)
    loadDoctors(c.id)
  }

  async function loadBookings(clinicId) {
    const b = await getBookings(clinicId, { date: dateFilter || undefined, status: statusFilter || undefined })
    setBookings(b)
  }

  async function loadTreatments(clinicId) {
    const t = await getTreatments(clinicId)
    setTreatments(t)
  }

  async function loadDoctors(clinicId) {
    const d = await getDoctors(clinicId)
    setDoctors(d)
  }

  useEffect(() => {
    if (clinic) loadBookings(clinic.id)
  }, [dateFilter, statusFilter])

  async function handleLogin() {
    setLL(true); setLoginErr('')
    try {
      await signIn(loginForm.email, loginForm.password)
      setAuthed(true)
      await loadClinic()
    } catch (e) {
      setLoginErr('อีเมลหรือรหัสผ่านไม่ถูกต้อง')
    }
    setLL(false)
  }

  async function handleStatusChange(bookingId, status) {
    await updateBookingStatus(bookingId, status)
    loadBookings(clinic.id)
    if (clinic.line_token && status === 'confirmed') {
      const b = bookings.find(x => x.id === bookingId)
      if (b) {
        await fetch('/api/line-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lineToken: clinic.line_token,
            type: 'confirm',
            clinicName: clinic.name,
            treatment: b.treatment_names || b.treatments?.name,
            patientName: b.patient_name,
            phone: b.phone,
            lineId: b.line_id,
            date: b.booked_date,
            time: b.booked_time,
            bookingId: b.id.slice(0, 8).toUpperCase(),
          }),
        })
      }
    }
  }

  async function saveTreatment() {
    if (!tForm.name || !tForm.price) return alert('กรอกชื่อและราคาด้วยนะ')
    setTLoading(true)
    try {
      if (tForm.id) { await updateTreatment(tForm.id, tForm) }
      else { await createTreatment(clinic.id, tForm) }
      setTForm(null)
      loadTreatments(clinic.id)
    } catch (e) { alert('เกิดข้อผิดพลาด') }
    setTLoading(false)
  }

  async function saveDoctor() {
    if (!dForm.name) return alert('กรอกชื่อแพทย์ด้วยนะ')
    try {
      await upsertDoctor({ ...dForm, clinic_id: clinic.id })
      setDForm(null)
      loadDoctors(clinic.id)
    } catch (e) { alert('เกิดข้อผิดพลาด') }
  }

  async function handleImageUpload(e, setter, field) {
    const file = e.target.files[0]
    if (!file) return
    const url = await uploadImage(clinic.id, file, 'treatments')
    setter(prev => ({ ...prev, [field]: url }))
  }

  if (!authed) {
    return (
      <div style={s.loginPage}>
        <div style={s.loginBox}>
          <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 8 }}>🌸</div>
          <h1 style={s.loginTitle}>Blossom Admin</h1>
          <p style={s.loginSub}>เข้าสู่ระบบสำหรับคลินิก</p>
          <input type="email" placeholder="อีเมล" value={loginForm.email}
            onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} style={s.loginInput} />
          <input type="password" placeholder="รหัสผ่าน" value={loginForm.password}
            onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && handleLogin()} style={s.loginInput} />
          {loginErr && <p style={{ color: '#ef4444', fontSize: 13, textAlign: 'center' }}>{loginErr}</p>}
          <button onClick={handleLogin} disabled={loginLoading} style={s.loginBtn}>
            {loginLoading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </div>
      </div>
    )
  }

  if (!clinic) {
    return <div style={{ textAlign: 'center', padding: 80, color: '#e8748a' }}>กำลังโหลด...</div>
  }

  const todayBookings = bookings.filter(b => b.booked_date === new Date().toISOString().split('T')[0])
  const revenue = bookings.filter(b => b.status !== 'cancelled').reduce((s, b) => s + (b.total_price || b.treatments?.price || 0), 0)

  return (
    <div style={s.adminPage}>
      <div style={s.sidebar}>
        <div style={s.sidebarTop}>
          <div style={{ fontSize: 28 }}>🌸</div>
          <p style={s.sidebarClinicName}>{clinic.name}</p>
          <p style={s.sidebarSub}>Admin Panel</p>
        </div>
        {[
          { key: 'bookings', icon: '📋', label: 'คิว / จองคิว' },
          { key: 'treatments', icon: '💉', label: 'หัตถการ & ราคา' },
          { key: 'doctors', icon: '👩‍⚕️', label: 'แพทย์ / Staff' },
          { key: 'settings', icon: '⚙️', label: 'ตั้งค่าคลินิก' },
        ].map(item => (
          <button key={item.key} onClick={() => setTab(item.key)} style={{
            ...s.sidebarBtn,
            background: tab === item.key ? '#fce4ec' : 'transparent',
            color: tab === item.key ? '#c2185b' : '#6b7280',
            fontWeight: tab === item.key ? 700 : 400,
          }}>
            <span style={{ fontSize: 18 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        <button onClick={async () => { await signOut(); setAuthed(false) }} style={s.logoutBtn}>
          ออกจากระบบ
        </button>
      </div>

      <div style={s.main}>
        {tab === 'bookings' && (
          <>
            <div style={s.statsRow}>
              <StatCard icon="📅" label="จองวันนี้" value={todayBookings.length} color="#e8748a" />
              <StatCard icon="⏳" label="รอยืนยัน" value={bookings.filter(b => b.status === 'pending').length} color="#f59e0b" />
              <StatCard icon="✅" label="ยืนยันแล้ว" value={bookings.filter(b => b.status === 'confirmed').length} color="#10b981" />
              <StatCard icon="💰" label={`รายได้ (${dateFilter || 'ทั้งหมด'})`} value={`฿${revenue.toLocaleString()}`} color="#8b5cf6" />
            </div>
            <div style={s.filterRow}>
              <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={s.filterInput} />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={s.filterInput}>
                <option value="">ทุกสถานะ</option>
                <option value="pending">รอยืนยัน</option>
                <option value="confirmed">ยืนยันแล้ว</option>
                <option value="cancelled">ยกเลิก</option>
              </select>
              <button onClick={() => { setDateFilter(''); setStatusFilter('') }} style={s.clearBtn}>ล้างตัวกรอง</button>
            </div>
            {bookings.length === 0 ? (
              <div style={s.empty}>ไม่มีการจองในช่วงเวลานี้</div>
            ) : (
              <div style={s.bookingList}>
                {bookings.map(b => (
                  <div key={b.id} style={s.bookingCard}>
                    <div style={s.bookingTop}>
                      <div>
                        <div style={s.bookingName}>{b.patient_name}</div>
                        <div style={s.bookingMeta}>📞 {b.phone}{b.line_id && <> · 💬 {b.line_id}</>}</div>
                      </div>
                      <span style={{ ...s.badge, background: STATUS_BG[b.status], color: STATUS_COLOR[b.status] }}>
                        {STATUS_LABEL[b.status]}
                      </span>
                    </div>
                    <div style={s.bookingTreat}>
                      💉 {b.treatment_names || b.treatments?.name || '—'}
                      {b.doctor_name && <> · 👩‍⚕️ {b.doctor_name}</>}
                    </div>
                    <div style={s.bookingTimeRow}>
                      <span>📅 {new Date(b.booked_date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      <span>🕐 {b.booked_time?.slice(0, 5)} น.</span>
                      <span style={{ color: '#8b5cf6', fontWeight: 700 }}>฿{(b.total_price || b.treatments?.price || 0).toLocaleString()}</span>
                    </div>
                    {b.note && <div style={s.bookingNote}>📝 {b.note}</div>}
                    <div style={s.bookingActions}>
                      {b.status === 'pending' && (
                        <>
                          <button onClick={() => handleStatusChange(b.id, 'confirmed')} style={{ ...s.actionBtn, background: '#10b981', color: '#fff' }}>
                            ✅ ยืนยัน + แจ้ง LINE
                          </button>
                          <button onClick={() => handleStatusChange(b.id, 'cancelled')} style={{ ...s.actionBtn, background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5' }}>
                            ❌ ยกเลิก
                          </button>
                        </>
                      )}
                      {b.status === 'confirmed' && (
                        <button onClick={() => handleStatusChange(b.id, 'cancelled')} style={{ ...s.actionBtn, background: '#fef2f2', color: '#ef4444', border: '1px solid #fca5a5' }}>
                          ยกเลิกนัด
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'treatments' && (
          <>
            <div style={s.tabHeader}>
              <h2 style={s.tabTitle}>หัตถการ & ราคา</h2>
              <button onClick={() => setTForm({ name: '', price: '', duration_min: 60, tag: '', description: '', is_active: true })} style={s.addBtn}>
                + เพิ่มหัตถการ
              </button>
            </div>
            {tForm && (
              <div style={s.modal}>
                <div style={s.modalBox}>
                  <h3 style={s.modalTitle}>{tForm.id ? 'แก้ไขหัตถการ' : 'เพิ่มหัตถการใหม่'}</h3>
                  <FormField label="ชื่อหัตถการ *">
                    <input value={tForm.name || ''} onChange={e => setTForm({ ...tForm, name: e.target.value })} style={s.modalInput} />
                  </FormField>
                  <FormField label="ประเภท (tag) เช่น Botox, Filler, Laser">
                    <input value={tForm.tag || ''} onChange={e => setTForm({ ...tForm, tag: e.target.value })} style={s.modalInput} />
                  </FormField>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <FormField label="ราคาปกติ (฿) *">
                      <input type="number" value={tForm.price || ''} onChange={e => setTForm({ ...tForm, price: +e.target.value })} style={s.modalInput} />
                    </FormField>
                    <FormField label="ราคาโปรโมชัน (฿)">
                      <input type="number" value={tForm.discount_price || ''} onChange={e => setTForm({ ...tForm, discount_price: +e.target.value || null })} style={s.modalInput} />
                    </FormField>
                  </div>
                  <FormField label="ระยะเวลา (นาที)">
                    <input type="number" value={tForm.duration_min || ''} onChange={e => setTForm({ ...tForm, duration_min: +e.target.value })} style={s.modalInput} />
                  </FormField>
                  <FormField label="คำอธิบาย">
                    <textarea value={tForm.description || ''} onChange={e => setTForm({ ...tForm, description: e.target.value })} rows={2} style={{ ...s.modalInput, resize: 'vertical' }} />
                  </FormField>
                  <FormField label="รูปภาพ">
                    {tForm.image_url && <img src={tForm.image_url} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }} />}
                    <input type="file" accept="image/*" onChange={e => handleImageUpload(e, setTForm, 'image_url')} style={{ fontSize: 13 }} />
                  </FormField>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginTop: 4 }}>
                    <input type="checkbox" checked={tForm.is_active} onChange={e => setTForm({ ...tForm, is_active: e.target.checked })} />
                    แสดงในหน้าจอง (active)
                  </label>
                  <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                    <button onClick={saveTreatment} disabled={tLoading} style={{ ...s.addBtn, flex: 1 }}>
                      {tLoading ? 'กำลังบันทึก...' : '💾 บันทึก'}
                    </button>
                    <button onClick={() => setTForm(null)} style={{ ...s.clearBtn, flex: 1 }}>ยกเลิก</button>
                  </div>
                </div>
              </div>
            )}
            <div style={s.treatList}>
              {treatments.map(t => (
                <div key={t.id} style={{ ...s.treatRow, opacity: t.is_active ? 1 : 0.5 }}>
                  {t.image_url ? <img src={t.image_url} style={s.treatRowImg} /> : <div style={s.treatRowImgPlaceholder}>✨</div>}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={s.treatRowName}>{t.name}</span>
                      {t.tag && <span style={s.tagPill}>{t.tag}</span>}
                      {!t.is_active && <span style={{ ...s.tagPill, background: '#fee2e2', color: '#ef4444' }}>ซ่อน</span>}
                    </div>
                    <div style={s.treatRowPrice}>
                      {t.discount_price
                        ? <><s style={{ color: '#9ca3af', fontSize: 12 }}>฿{t.price.toLocaleString()}</s> <b style={{ color: '#e8748a' }}>฿{t.discount_price.toLocaleString()}</b></>
                        : <b style={{ color: '#e8748a' }}>฿{t.price.toLocaleString()}</b>}
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>· {t.duration_min} นาที</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setTForm(t)} style={s.editBtn}>✏️ แก้ไข</button>
                    <button onClick={async () => { if (confirm('ลบหัตถการนี้?')) { await deleteTreatment(t.id); loadTreatments(clinic.id) } }} style={s.deleteBtn}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'doctors' && (
          <>
            <div style={s.tabHeader}>
              <h2 style={s.tabTitle}>แพทย์ / Staff</h2>
              <button onClick={() => setDForm({ name: '', specialty: '', is_active: true })} style={s.addBtn}>+ เพิ่มแพทย์</button>
            </div>
            {dForm && (
              <div style={s.modal}>
                <div style={s.modalBox}>
                  <h3 style={s.modalTitle}>{dForm.id ? 'แก้ไขแพทย์' : 'เพิ่มแพทย์ใหม่'}</h3>
                  <FormField label="ชื่อแพทย์ / Staff *">
                    <input value={dForm.name || ''} onChange={e => setDForm({ ...dForm, name: e.target.value })} style={s.modalInput} />
                  </FormField>
                  <FormField label="ความเชี่ยวชาญ เช่น Filler, Botox, Laser">
                    <input value={dForm.specialty || ''} onChange={e => setDForm({ ...dForm, specialty: e.target.value })} style={s.modalInput} />
                  </FormField>
                  <FormField label="รูปโปรไฟล์">
                    {dForm.photo_url && <img src={dForm.photo_url} style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', marginBottom: 8 }} />}
                    <input type="file" accept="image/*" onChange={e => handleImageUpload(e, setDForm, 'photo_url')} style={{ fontSize: 13 }} />
                  </FormField>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, marginTop: 4 }}>
                    <input type="checkbox" checked={dForm.is_active} onChange={e => setDForm({ ...dForm, is_active: e.target.checked })} />
                    แสดงให้ลูกค้าเลือก (active)
                  </label>
                  <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                    <button onClick={saveDoctor} style={{ ...s.addBtn, flex: 1 }}>💾 บันทึก</button>
                    <button onClick={() => setDForm(null)} style={{ ...s.clearBtn, flex: 1 }}>ยกเลิก</button>
                  </div>
                </div>
              </div>
            )}
            <div style={s.doctorList}>
              {doctors.map(d => (
                <div key={d.id} style={{ ...s.doctorRow, opacity: d.is_active ? 1 : 0.5 }}>
                  {d.photo_url ? <img src={d.photo_url} style={s.doctorRowPhoto} /> : <div style={s.doctorRowAvatar}>👩‍⚕️</div>}
                  <div style={{ flex: 1 }}>
                    <div style={s.doctorRowName}>{d.name}</div>
                    {d.specialty && <div style={s.doctorRowSub}>{d.specialty}</div>}
                    {!d.is_active && <span style={{ ...s.tagPill, background: '#fee2e2', color: '#ef4444' }}>ซ่อน</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setDForm(d)} style={s.editBtn}>✏️ แก้ไข</button>
                    <button onClick={async () => { if (confirm('ลบแพทย์นี้?')) { await deleteDoctor(d.id); loadDoctors(clinic.id) } }} style={s.deleteBtn}>🗑</button>
                  </div>
                </div>
              ))}
              {doctors.length === 0 && <div style={s.empty}>ยังไม่มีแพทย์ กด "+ เพิ่มแพทย์" ด้านบน</div>}
            </div>
          </>
        )}

        {tab === 'settings' && (
          <div style={{ maxWidth: 480 }}>
            <h2 style={s.tabTitle}>ตั้งค่าคลินิก</h2>
            <div style={s.settingCard}>
              <h3 style={s.settingSection}>🔗 LINE Messaging API</h3>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12, lineHeight: 1.6 }}>
                ใส่ Channel Access Token จาก <a href="https://developers.line.biz/" target="_blank" style={{ color: '#e8748a' }}>LINE Developers Console</a><br />
                เมื่อกด "ยืนยัน" ระบบจะส่ง LINE แจ้งเตือนให้คลินิกอัตโนมัติ
              </p>
              <label style={s.label}>Channel Access Token</label>
              <input type="text" defaultValue={clinic.line_token || ''} placeholder="ใส่ token ที่ได้จาก LINE Developers" style={s.modalInput} id="line_token_input" />
              <button style={{ ...s.addBtn, marginTop: 12 }} onClick={async () => {
                const token = document.getElementById('line_token_input').value
                const { error } = await supabase.from('clinics').update({ line_token: token }).eq('id', clinic.id)
                if (!error) alert('บันทึกสำเร็จ!')
              }}>
                💾 บันทึก Token
              </button>
            </div>
            <div style={s.settingCard}>
              <h3 style={s.settingSection}>🏥 ลิงก์จองของคุณ</h3>
              <a href={`/${clinic.slug}/book`} target="_blank" style={{ color: '#e8748a', fontWeight: 700, fontSize: 14 }}>
                {typeof window !== 'undefined' ? window.location.origin : ''}/{clinic.slug}/book
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '16px 20px', border: '1px solid #f3e8eb' }}>
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

const s = {
  loginPage: { minHeight: '100vh', background: '#fdf8f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Sarabun','Noto Sans Thai',sans-serif" },
  loginBox: { background: '#fff', borderRadius: 20, padding: '36px 32px', width: 360, border: '1px solid #f3e8eb', boxShadow: '0 4px 24px rgba(232,116,138,0.1)' },
  loginTitle: { fontSize: 24, fontWeight: 700, color: '#c2185b', textAlign: 'center', margin: '0 0 4px' },
  loginSub: { color: '#9ca3af', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  loginInput: { width: '100%', boxSizing: 'border-box', border: '1.5px solid #f3e8eb', borderRadius: 10, padding: '10px 14px', fontSize: 15, marginBottom: 12, fontFamily: 'inherit', outline: 'none' },
  loginBtn: { width: '100%', padding: 13, borderRadius: 12, background: '#e8748a', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', marginTop: 4 },
  adminPage: { display: 'flex', minHeight: '100vh', fontFamily: "'Sarabun','Noto Sans Thai',sans-serif", background: '#faf7f8' },
  sidebar: { width: 220, background: '#fff', borderRight: '1px solid #f3e8eb', display: 'flex', flexDirection: 'column', padding: '24px 12px', gap: 4, flexShrink: 0 },
  sidebarTop: { textAlign: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f3e8eb' },
  sidebarClinicName: { fontWeight: 700, fontSize: 15, color: '#c2185b', margin: '8px 0 2px' },
  sidebarSub: { fontSize: 11, color: '#9ca3af', margin: 0 },
  sidebarBtn: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14, transition: 'all 0.15s', textAlign: 'left' },
  logoutBtn: { marginTop: 'auto', padding: '10px 14px', borderRadius: 12, border: '1px solid #f3e8eb', cursor: 'pointer', fontSize: 13, color: '#9ca3af', background: 'transparent' },
  main: { flex: 1, padding: '28px 32px', overflow: 'auto' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 },
  filterRow: { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' },
  filterInput: { padding: '8px 12px', border: '1.5px solid #f3e8eb', borderRadius: 10, fontSize: 14, background: '#fff', fontFamily: 'inherit' },
  clearBtn: { padding: '8px 16px', border: '1.5px solid #f3e8eb', borderRadius: 10, cursor: 'pointer', fontSize: 13, color: '#6b7280', background: '#fff' },
  bookingList: { display: 'flex', flexDirection: 'column', gap: 12 },
  bookingCard: { background: '#fff', border: '1px solid #f3e8eb', borderRadius: 16, padding: '16px 20px' },
  bookingTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  bookingName: { fontSize: 16, fontWeight: 700, color: '#1a1a1a' },
  bookingMeta: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  bookingTreat: { fontSize: 14, color: '#374151', marginBottom: 8 },
  bookingTimeRow: { display: 'flex', gap: 16, fontSize: 13, color: '#6b7280', marginBottom: 8, flexWrap: 'wrap' },
  bookingNote: { fontSize: 13, color: '#6b7280', background: '#fdf9fa', borderRadius: 8, padding: '6px 10px', marginBottom: 10 },
  bookingActions: { display: 'flex', gap: 8 },
  actionBtn: { padding: '7px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  badge: { fontSize: 12, padding: '4px 10px', borderRadius: 99, fontWeight: 600 },
  tabHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  tabTitle: { fontSize: 20, fontWeight: 700, color: '#c2185b', margin: 0 },
  addBtn: { padding: '9px 18px', borderRadius: 12, background: '#e8748a', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  treatList: { display: 'flex', flexDirection: 'column', gap: 10 },
  treatRow: { display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: '1px solid #f3e8eb', borderRadius: 14, padding: '12px 16px' },
  treatRowImg: { width: 56, height: 56, borderRadius: 10, objectFit: 'cover', flexShrink: 0 },
  treatRowImgPlaceholder: { width: 56, height: 56, borderRadius: 10, background: '#fce4ec', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 },
  treatRowName: { fontSize: 15, fontWeight: 700, color: '#1a1a1a' },
  treatRowPrice: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 },
  tagPill: { fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#fce4ec', color: '#e91e8c', fontWeight: 600 },
  editBtn: { padding: '6px 12px', borderRadius: 8, border: '1px solid #f3e8eb', cursor: 'pointer', fontSize: 13, background: '#fff' },
  deleteBtn: { padding: '6px 10px', borderRadius: 8, border: '1px solid #fca5a5', cursor: 'pointer', fontSize: 13, background: '#fef2f2', color: '#ef4444' },
  doctorList: { display: 'flex', flexDirection: 'column', gap: 10 },
  doctorRow: { display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: '1px solid #f3e8eb', borderRadius: 14, padding: '12px 16px' },
  doctorRowPhoto: { width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  doctorRowAvatar: { width: 52, height: 52, borderRadius: '50%', background: '#fce4ec', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, flexShrink: 0 },
  doctorRowName: { fontSize: 15, fontWeight: 700, color: '#1a1a1a' },
  doctorRowSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modalBox: { background: '#fff', borderRadius: 20, padding: '28px 28px', width: 480, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#c2185b', margin: '0 0 20px' },
  modalInput: { width: '100%', boxSizing: 'border-box', border: '1.5px solid #f3e8eb', borderRadius: 10, padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', outline: 'none' },
  settingCard: { background: '#fff', border: '1px solid #f3e8eb', borderRadius: 16, padding: '20px 24px', marginBottom: 16 },
  settingSection: { fontSize: 16, fontWeight: 700, color: '#374151', margin: '0 0 12px' },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  empty: { textAlign: 'center', padding: '40px 20px', color: '#9ca3af', fontSize: 14 },
}
