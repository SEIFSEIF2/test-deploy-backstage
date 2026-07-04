import { config } from '@/lib/config'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const OPEN_HOUR = 7
const CLOSE_HOUR = 18

interface DateParts {
  weekdayIdx: number
  hour: number
  minute: number
}

function partsInAppTz(date: Date): DateParts {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: config.timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  const weekdayIdx = WEEKDAYS.indexOf(get('weekday'))
  return {
    weekdayIdx,
    hour: Number(get('hour')),
    minute: Number(get('minute'))
  }
}

export interface QuickRoomWindow {
  open: boolean
  label: string
}

export function isQuickRoomOpen(date: Date = new Date()): QuickRoomWindow {
  const { weekdayIdx, hour } = partsInAppTz(date)
  const isWeekday = weekdayIdx >= 1 && weekdayIdx <= 5
  const inHours = hour >= OPEN_HOUR && hour < CLOSE_HOUR
  if (isWeekday && inHours) {
    return { open: true, label: `Closes at ${CLOSE_HOUR}:00` }
  }
  let daysAhead = 0
  if (isWeekday && hour < OPEN_HOUR) {
    daysAhead = 0
  } else {
    let probe = weekdayIdx
    daysAhead = 1
    while (true) {
      probe = (probe + 1) % 7
      if (probe >= 1 && probe <= 5) break
      daysAhead++
    }
  }
  const nextWeekdayIdx = (weekdayIdx + daysAhead) % 7
  const nextDayName =
    daysAhead === 0
      ? 'today'
      : daysAhead === 1
        ? 'tomorrow'
        : [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday'
          ][nextWeekdayIdx]
  return {
    open: false,
    label: `Opens ${nextDayName} at ${OPEN_HOUR}:00`
  }
}
