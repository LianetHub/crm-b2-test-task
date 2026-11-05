import {
  Avatar,
  Box,
  Link,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'
import type { Task } from '../../lib/types'
import { StatusChip } from './StatusChip'
import { EmptyState } from '../../components/Feedback'

export function TaskTable({ tasks, projects }: { tasks: Task[]; projects?: Record<string, string> }) {
  if (!tasks.length)
    return <EmptyState title="Задач пока нет" text="Здесь появятся задачи, доступные вам для работы." />
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table aria-label="Список задач" sx={{ minWidth: 620 }}>
        <TableHead>
          <TableRow>
            <TableCell>Задача</TableCell>
            <TableCell>Статус</TableCell>
            <TableCell>Исполнитель</TableCell>
            <TableCell align="right">Создана</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {tasks.map((task) => (
            <TableRow key={task.id} hover>
              <TableCell sx={{ maxWidth: 420 }}>
                <Link
                  component={RouterLink}
                  to={`/tasks/${task.id}`}
                  underline="hover"
                  sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}
                >
                  {task.title}
                </Link>
                {projects && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.7 }}>
                    {projects[task.project_id] ?? 'Объект'}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                <StatusChip status={task.status} />
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Avatar sx={{ width: 27, height: 27, bgcolor: '#eceee8', color: '#67736c', fontSize: 11 }}>
                    {task.assignee_name.slice(0, 1)}
                  </Avatar>
                  <Box sx={{ fontSize: 12 }}>{task.assignee_name}</Box>
                </Stack>
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: 'text.secondary', fontSize: 12 }}>
                {new Date(task.created_at).toLocaleDateString('ru-RU')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}
