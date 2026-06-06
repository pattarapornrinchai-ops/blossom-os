import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ============================================================
// AUTH
// ============================================================

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// ============================================================
// CLINIC
// ============================================================

export async function getClinicBySlug(slug) {
  const { data, error } = await supabase
    .from('clinics')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error) throw error
  return data
}

export async function getMyClinic(userId) {
  const { data, error } = await supabase
    .from('clinic_users')
    .select('clinic_id, clinics(*)')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data.clinics
}

export async function updateClinic(clinicId, updates) {
  const { data, error } = await supabase
    .from('clinics')
    .update(updates)
    .eq('id', clinicId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================================
// TREATMENTS
// ============================================================

export async function getTreatments(clinicId) {
  const { data, error } = await supabase
    .from('treatments')
    .select('*')
    .eq('clinic_id', clinicId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function createTreatment(clinicId, treatment) {
  const { data, error } = await supabase
    .from('treatments')
    .insert({ ...treatment, clinic_id: clinicId })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTreatment(id, updates) {
  const { data, error } = await supabase
    .from('treatments')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTreatment(id) {
  const { error } = await supabase.from('treatments').delete().eq('id', id)
  if (error) throw error
}

// ============================================================
// BOOKINGS
// ============================================================

export async function getBookings(clinicId, filters = {}) {
  let query = supabase
    .from('bookings')
    .select('*, treatments(name, price)')
    .eq('clinic_id', clinicId)
    .order('booked_date', { ascending: true })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.date) query = query.eq('booked_date', filters.date)

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function createBooking(booking) {
  const { data, error } = await supabase
    .from('bookings')
    .insert(booking)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateBookingStatus(id, status) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ============================================================
// STORAGE — อัปโหลดรูป
// ============================================================

export async function uploadImage(clinicId, file, folder = 'treatments') {
  const ext = file.name.split('.').pop()
  const path = `${clinicId}/${folder}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from('clinic-assets')
    .upload(path, file, { upsert: true })

  if (error) throw error

  const { data } = supabase.storage.from('clinic-assets').getPublicUrl(path)
  return data.publicUrl
}

export async function deleteImage(url) {
  // แปลง public URL → path
  const path = url.split('/clinic-assets/')[1]
  if (!path) return
  await supabase.storage.from('clinic-assets').remove([path])
}
