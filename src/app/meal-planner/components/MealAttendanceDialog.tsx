'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Typography,
  Box,
  Alert,
  Chip,
  Divider
} from '@mui/material'
import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'

interface FamilyMember {
  id: string
  name: string
  dietary_restrictions?: string[]
  food_allergies?: string[]
}

interface MealAttendanceDialogProps {
  open: boolean
  onClose: () => void
  mealDate: string
  mealType: string
  mealName: string
  onConfirm: (attendingMembers: string[], dietaryNeeds: string[]) => void
}

export default function MealAttendanceDialog({
  open,
  onClose,
  mealDate,
  mealType,
  mealName,
  onConfirm
}: MealAttendanceDialogProps) {
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([])
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      loadFamilyMembers()
    }
  }, [open])

  const loadFamilyMembers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('family_members')
        .select('*')
        .eq('household_id', user.id)

      if (error) throw error

      setFamilyMembers(data || [])
      // Default to all members selected
      setSelectedMembers(new Set(data?.map(m => m.id) || []))
    } catch (err: any) {
      console.error('Error loading family members:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleMember = (memberId: string) => {
    const newSelected = new Set(selectedMembers)
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId)
    } else {
      newSelected.add(memberId)
    }
    setSelectedMembers(newSelected)
  }

  const handleConfirm = () => {
    const attendingMembers = Array.from(selectedMembers)

    // Collect all dietary restrictions from attending members
    const dietaryNeeds = new Set<string>()
    familyMembers
      .filter(member => selectedMembers.has(member.id))
      .forEach(member => {
        if (member.dietary_restrictions) {
          member.dietary_restrictions.forEach(r => dietaryNeeds.add(r))
        }
        if (member.food_allergies) {
          member.food_allergies.forEach(a => dietaryNeeds.add(`allergy_${a.toLowerCase()}`))
        }
      })

    onConfirm(attendingMembers, Array.from(dietaryNeeds))
    onClose()
  }

  const getSelectedDietaryInfo = () => {
    const restrictions = new Set<string>()
    const allergies = new Set<string>()

    familyMembers
      .filter(member => selectedMembers.has(member.id))
      .forEach(member => {
        if (member.dietary_restrictions) {
          member.dietary_restrictions.forEach(r => restrictions.add(r))
        }
        if (member.food_allergies) {
          member.food_allergies.forEach(a => allergies.add(a))
        }
      })

    return { restrictions: Array.from(restrictions), allergies: Array.from(allergies) }
  }

  const dietaryInfo = getSelectedDietaryInfo()

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Who's Eating {mealType.charAt(0).toUpperCase() + mealType.slice(1)}?
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            {format(new Date(mealDate), 'EEEE, MMMM d')}
          </Typography>
          <Typography variant="h6">{mealName}</Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {familyMembers.length === 0 ? (
          <Alert severity="info">
            No family members found. Add family members in settings to track individual dietary needs.
          </Alert>
        ) : (
          <>
            <FormGroup>
              {familyMembers.map(member => (
                <FormControlLabel
                  key={member.id}
                  control={
                    <Checkbox
                      checked={selectedMembers.has(member.id)}
                      onChange={() => handleToggleMember(member.id)}
                    />
                  }
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <span>{member.name}</span>
                      {member.dietary_restrictions && member.dietary_restrictions.length > 0 && (
                        <Chip size="small" label={member.dietary_restrictions[0]} color="primary" />
                      )}
                      {member.food_allergies && member.food_allergies.length > 0 && (
                        <Chip size="small" label={`Allergy: ${member.food_allergies[0]}`} color="warning" />
                      )}
                    </Box>
                  }
                />
              ))}
            </FormGroup>

            {selectedMembers.size > 0 && (
              <>
                <Divider sx={{ my: 2 }} />
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Combined Dietary Requirements:
                  </Typography>

                  {dietaryInfo.restrictions.length > 0 && (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Dietary Restrictions:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                        {dietaryInfo.restrictions.map(r => (
                          <Chip key={r} size="small" label={r} color="primary" />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {dietaryInfo.allergies.length > 0 && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Allergies:
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                        {dietaryInfo.allergies.map(a => (
                          <Chip key={a} size="small" label={a} color="warning" />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {dietaryInfo.restrictions.length === 0 && dietaryInfo.allergies.length === 0 && (
                    <Typography variant="body2" color="text.secondary">
                      No special dietary requirements
                    </Typography>
                  )}
                </Box>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={selectedMembers.size === 0}
        >
          Confirm
        </Button>
      </DialogActions>
    </Dialog>
  )
}