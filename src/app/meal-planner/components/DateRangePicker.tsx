'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Chip,
  Grid,
  Paper
} from '@mui/material'
import {
  Close as CloseIcon,
  CalendarMonth,
  NavigateBefore,
  NavigateNext,
  Event as EventIcon,
  DateRange as DateRangeIcon
} from '@mui/icons-material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar'
import { format, addDays, startOfWeek, endOfWeek, differenceInDays } from 'date-fns'

interface DateRangePickerProps {
  open: boolean
  onClose: () => void
  onConfirm: (startDate: Date, endDate: Date) => void
  initialStartDate?: Date | null
  initialEndDate?: Date | null
  title?: string
}

export default function DateRangePicker({
  open,
  onClose,
  onConfirm,
  initialStartDate,
  initialEndDate,
  title = 'Select Date Range'
}: DateRangePickerProps) {
  const [startDate, setStartDate] = useState<Date | null>(initialStartDate || new Date())
  const [endDate, setEndDate] = useState<Date | null>(initialEndDate || null)
  const [selectingStart, setSelectingStart] = useState(true)

  const handleDateSelect = (date: Date | null) => {
    if (!date) return

    if (selectingStart) {
      setStartDate(date)
      setEndDate(null)
      setSelectingStart(false)
    } else {
      if (date >= (startDate || new Date())) {
        setEndDate(date)
      } else {
        // If selected date is before start date, swap them
        setEndDate(startDate)
        setStartDate(date)
      }
    }
  }

  const handleQuickSelect = (days: number) => {
    const start = new Date()
    const end = addDays(start, days - 1)
    setStartDate(start)
    setEndDate(end)
    setSelectingStart(false)
  }

  const handleWeekSelect = () => {
    const start = startOfWeek(new Date(), { weekStartsOn: 0 })
    const end = endOfWeek(new Date(), { weekStartsOn: 0 })
    setStartDate(start)
    setEndDate(end)
    setSelectingStart(false)
  }

  const handleConfirm = () => {
    if (startDate) {
      onConfirm(startDate, endDate || startDate)
      onClose()
    }
  }

  const getDayCount = () => {
    if (startDate && endDate) {
      return differenceInDays(endDate, startDate) + 1
    }
    return 1
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '600px' }
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={1}>
              <CalendarMonth color="primary" />
              <Typography variant="h6">{title}</Typography>
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {/* Quick Selection Chips */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom color="text.secondary">
              Quick Select:
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              <Chip
                label="This Week"
                onClick={handleWeekSelect}
                color={getDayCount() === 7 ? "primary" : "default"}
                variant={getDayCount() === 7 ? "filled" : "outlined"}
                icon={<DateRangeIcon />}
              />
              <Chip
                label="3 Days"
                onClick={() => handleQuickSelect(3)}
                color={getDayCount() === 3 ? "primary" : "default"}
                variant={getDayCount() === 3 ? "filled" : "outlined"}
              />
              <Chip
                label="5 Days"
                onClick={() => handleQuickSelect(5)}
                color={getDayCount() === 5 ? "primary" : "default"}
                variant={getDayCount() === 5 ? "filled" : "outlined"}
              />
              <Chip
                label="7 Days"
                onClick={() => handleQuickSelect(7)}
                color={getDayCount() === 7 ? "primary" : "default"}
                variant={getDayCount() === 7 ? "filled" : "outlined"}
              />
              <Chip
                label="14 Days"
                onClick={() => handleQuickSelect(14)}
                color={getDayCount() === 14 ? "primary" : "default"}
                variant={getDayCount() === 14 ? "filled" : "outlined"}
              />
            </Box>
          </Box>

          {/* Selected Date Display */}
          <Paper sx={{ p: 2, mb: 3, bgcolor: 'primary.light' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={5}>
                <Box
                  onClick={() => setSelectingStart(true)}
                  sx={{
                    cursor: 'pointer',
                    p: 1,
                    borderRadius: 1,
                    bgcolor: selectingStart ? 'white' : 'transparent',
                    transition: 'all 0.3s'
                  }}
                >
                  <Typography variant="caption" color={selectingStart ? 'primary' : 'primary.contrastText'}>
                    START DATE
                  </Typography>
                  <Typography variant="h6" color={selectingStart ? 'primary' : 'primary.contrastText'}>
                    {startDate ? format(startDate, 'MMM d, yyyy') : 'Select start'}
                  </Typography>
                </Box>
              </Grid>

              <Grid item xs={12} sm={2} sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="primary.contrastText">→</Typography>
              </Grid>

              <Grid item xs={12} sm={5}>
                <Box
                  onClick={() => setSelectingStart(false)}
                  sx={{
                    cursor: 'pointer',
                    p: 1,
                    borderRadius: 1,
                    bgcolor: !selectingStart ? 'white' : 'transparent',
                    transition: 'all 0.3s'
                  }}
                >
                  <Typography variant="caption" color={!selectingStart ? 'primary' : 'primary.contrastText'}>
                    END DATE
                  </Typography>
                  <Typography variant="h6" color={!selectingStart ? 'primary' : 'primary.contrastText'}>
                    {endDate ? format(endDate, 'MMM d, yyyy') : 'Select end'}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {startDate && endDate && (
              <Box textAlign="center" mt={2}>
                <Chip
                  label={`${getDayCount()} days selected`}
                  color="primary"
                  variant="outlined"
                  sx={{ bgcolor: 'white' }}
                />
              </Box>
            )}
          </Paper>

          {/* Calendar */}
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <DateCalendar
              value={selectingStart ? startDate : endDate}
              onChange={handleDateSelect}
              minDate={selectingStart ? new Date() : startDate || new Date()}
              sx={{
                '& .MuiPickersDay-root': {
                  '&.Mui-selected': {
                    backgroundColor: selectingStart ? 'primary.main' : 'secondary.main',
                  }
                }
              }}
            />
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>
            {selectingStart ? 'Select the start date for your meal plan' : 'Select the end date for your meal plan'}
          </Typography>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            variant="contained"
            disabled={!startDate}
            startIcon={<EventIcon />}
          >
            Confirm Dates
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  )
}