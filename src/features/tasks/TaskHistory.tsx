import { Box, Paper, Typography } from '@mui/material'
import type { HistoryEvent } from '../../lib/types'
import { ErrorPanel, Loading } from '../../components/Feedback'
import { statusLabels } from './status'

export function TaskHistory({
  events,
  loading,
  error,
  onRetry,
}: {
  events?: HistoryEvent[]
  loading: boolean
  error: unknown
  onRetry: () => void
}) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h6" component="h2" sx={{ mb: 3 }}>
        История изменений
      </Typography>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorPanel error={error} retry={onRetry} />
      ) : (
        <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }}>
          {events!.map((event, index) => (
            <Box
              component="li"
              key={event.id}
              sx={{
                position: 'relative',
                pl: 3,
                pb: index === events!.length - 1 ? 0 : 3,
                '&:before': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  top: 5,
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  bgcolor: index === 0 ? 'primary.main' : 'divider',
                },
                '&:after':
                  index === events!.length - 1
                    ? undefined
                    : {
                        content: '""',
                        position: 'absolute',
                        left: 3,
                        top: 17,
                        bottom: 5,
                        width: '1px',
                        bgcolor: 'divider',
                      },
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {event.from_status
                  ? `${statusLabels[event.from_status]} → ${statusLabels[event.to_status]}`
                  : 'Задача создана'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                {event.actor_name} ·{' '}
                {new Date(event.created_at).toLocaleString('ru-RU', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </Typography>
              {event.comment && (
                <Box
                  sx={{
                    mt: 1.2,
                    p: 1.5,
                    bgcolor: 'action.hover',
                    borderRadius: 1.5,
                    fontSize: 12,
                    lineHeight: 1.7,
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {event.comment}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  )
}
