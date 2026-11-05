import { Box, Chip } from '@mui/material'
import type { TaskStatus } from '../../lib/types'
import { statusLabels } from './status'

const styles: Record<TaskStatus, { bg: string; color: string }> = {
  new: { bg: '#f0f1ef', color: '#616c66' },
  in_progress: { bg: '#e6eefc', color: '#4565ab' },
  review: { bg: '#fff2da', color: '#946719' },
  accepted: { bg: '#e4f2e8', color: '#2b774b' },
  rework: { bg: '#fbe9e5', color: '#a4543c' },
}
export function StatusChip({ status }: { status: TaskStatus }) {
  const { bg, color } = styles[status]
  return (
    <Chip
      size="small"
      label={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
          <Box component="span" sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: color }} />
          {statusLabels[status]}
        </Box>
      }
      sx={{ bgcolor: bg, color, fontSize: 11, height: 27, fontWeight: 600 }}
    />
  )
}
