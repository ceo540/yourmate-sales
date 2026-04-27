import { google } from 'googleapis'

export const CALENDAR_MAP = {
  main:    process.env.GOOGLE_CALENDAR_ID_MAIN!,
  sos:     process.env.GOOGLE_CALENDAR_ID_SOS!,
  rental:  process.env.GOOGLE_CALENDAR_ID_RENTAL!,
  artqium: process.env.GOOGLE_CALENDAR_ID_ARTQIUM!,
}

export const CALENDAR_LABELS: Record<string, string> = {
  main:    '개인/전체',
  sos:     '사운드오브스쿨',
  rental:  '렌탈일정',
  artqium: '아트키움',
}

export const CALENDAR_COLORS: Record<string, string> = {
  main:    '#3B82F6',
  sos:     '#7C3AED',
  rental:  '#D97706',
  artqium: '#10B981',
}

export type GoogleCalEvent = {
  id: string
  googleEventId: string
  calendarId: string
  calendarKey: keyof typeof CALENDAR_MAP
  title: string
  date: string
  endDate: string
  startTime?: string
  endTime?: string
  isAllDay: boolean
  description: string
  color: string
}

function getClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n').trim(),
    },
    scopes: ['https://www.googleapis.com/auth/calendar'],
  })
  return google.calendar({ version: 'v3', auth })
}

export async function listEvents(year: number, month: number): Promise<GoogleCalEvent[]> {
  const cal = getClient()
  const timeMin = new Date(year, month, 1).toISOString()
  const timeMax = new Date(year, month + 1, 0, 23, 59, 59).toISOString()

  const results = await Promise.all(
    (Object.entries(CALENDAR_MAP) as [keyof typeof CALENDAR_MAP, string][]).map(async ([key, calendarId]) => {
      try {
        const res = await cal.events.list({
          calendarId,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 100,
        })
        return (res.data.items ?? []).map(ev => ({
          id: `gcal-${key}-${ev.id}`,
          googleEventId: ev.id!,
          calendarId,
          calendarKey: key,
          title: ev.summary ?? '(제목 없음)',
          date: (ev.start?.date ?? ev.start?.dateTime ?? '').slice(0, 10),
          endDate: (ev.end?.date ?? ev.end?.dateTime ?? '').slice(0, 10),
          startTime: ev.start?.dateTime ? ev.start.dateTime.slice(11, 16) : undefined,
          endTime: ev.end?.dateTime ? ev.end.dateTime.slice(11, 16) : undefined,
          isAllDay: !!ev.start?.date,
          description: ev.description ?? '',
          color: CALENDAR_COLORS[key],
        }))
      } catch (e) {
        console.error(`[gcal] ${key} error:`, e)
        return []
      }
    })
  )
  return results.flat()
}

// 검색어로 모든 캘린더의 일정 검색 (현재 ~ N개월 후)
export async function searchEvents(query: string, monthsAhead = 6): Promise<GoogleCalEvent[]> {
  const cal = getClient()
  const now = new Date()
  const timeMin = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const timeMax = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 0, 23, 59, 59).toISOString()

  const results = await Promise.all(
    (Object.entries(CALENDAR_MAP) as [keyof typeof CALENDAR_MAP, string][]).map(async ([key, calendarId]) => {
      try {
        const res = await cal.events.list({
          calendarId,
          q: query || undefined,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: 'startTime',
          maxResults: 30,
        })
        return (res.data.items ?? []).map(ev => ({
          id: `gcal-${key}-${ev.id}`,
          googleEventId: ev.id!,
          calendarId,
          calendarKey: key,
          title: ev.summary ?? '(제목 없음)',
          date: (ev.start?.date ?? ev.start?.dateTime ?? '').slice(0, 10),
          endDate: (ev.end?.date ?? ev.end?.dateTime ?? '').slice(0, 10),
          startTime: ev.start?.dateTime ? ev.start.dateTime.slice(11, 16) : undefined,
          endTime: ev.end?.dateTime ? ev.end.dateTime.slice(11, 16) : undefined,
          isAllDay: !!ev.start?.date,
          description: ev.description ?? '',
          color: CALENDAR_COLORS[key],
        }))
      } catch (e) {
        console.error(`[gcal search] ${key} error:`, e)
        return []
      }
    })
  )
  return results.flat()
}

export async function createEvent(calendarKey: string, data: {
  title: string
  date: string
  endDate?: string
  startTime?: string
  endTime?: string
  description?: string
  isAllDay?: boolean
}) {
  const cal = getClient()
  const calendarId = CALENDAR_MAP[calendarKey as keyof typeof CALENDAR_MAP]
  if (!calendarId) throw new Error('Invalid calendar key')

  // startTime이 비어있으면 '종일' 모드로 강제 (빈 dateTime으로 400 나는 것 방지)
  const isAllDay = data.isAllDay === true || !data.startTime
  const start = isAllDay
    ? { date: data.date }
    : { dateTime: `${data.date}T${data.startTime}:00`, timeZone: 'Asia/Seoul' }
  const end = isAllDay
    ? { date: data.endDate ?? data.date }
    : { dateTime: `${data.date}T${data.endTime ?? data.startTime}:00`, timeZone: 'Asia/Seoul' }

  const res = await cal.events.insert({
    calendarId,
    requestBody: { summary: data.title, description: data.description, start, end },
  })
  return res.data
}

export async function updateEvent(calendarKey: string, eventId: string, data: {
  title?: string
  date?: string
  endDate?: string
  startTime?: string
  endTime?: string
  description?: string
  isAllDay?: boolean
}) {
  const cal = getClient()
  const calendarId = CALENDAR_MAP[calendarKey as keyof typeof CALENDAR_MAP]
  if (!calendarId) throw new Error('Invalid calendar key')

  const isAllDay = data.isAllDay === true || !data.startTime
  const start = isAllDay
    ? { date: data.date }
    : { dateTime: `${data.date}T${data.startTime}:00`, timeZone: 'Asia/Seoul' }
  const end = isAllDay
    ? { date: data.endDate ?? data.date }
    : { dateTime: `${data.date}T${data.endTime ?? data.startTime}:00`, timeZone: 'Asia/Seoul' }

  const res = await cal.events.update({
    calendarId,
    eventId,
    requestBody: { summary: data.title, description: data.description, start, end },
  })
  return res.data
}

export async function deleteEvent(calendarKey: string, eventId: string) {
  const cal = getClient()
  const calendarId = CALENDAR_MAP[calendarKey as keyof typeof CALENDAR_MAP]
  if (!calendarId) throw new Error('Invalid calendar key')
  await cal.events.delete({ calendarId, eventId })
}
