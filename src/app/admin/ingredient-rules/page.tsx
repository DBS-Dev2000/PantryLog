'use client'

import { useState, useEffect } from 'react'
import {
  Container,
  Typography,
  Box,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Alert,
  Card,
  CardContent,
  Grid,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Autocomplete,
  Switch,
  FormControlLabel,
  Tooltip,
  Badge,
  CircularProgress
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Visibility as ViewIcon,
  ThumbUp as ThumbUpIcon,
  ThumbDown as ThumbDownIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Upload as UploadIcon
} from '@mui/icons-material'
import { supabase } from '@/lib/supabase'
import { isSystemAdmin } from '@/lib/adminAuth'
import { format } from 'date-fns'
import AdminNav from '@/components/AdminNav'

interface IngredientRule {
  id: string
  rule_type: 'equivalency' | 'exclusion' | 'category'
  ingredient_name: string
  equivalents?: string[]
  excluded_matches?: string[]
  category_info?: any
  confidence_threshold: number
  is_active: boolean
  is_system_default: boolean
  approved: boolean
  approved_by?: string
  approved_at?: string
  source: string
  notes?: string
  created_at: string
  updated_at: string
}

interface RuleSuggestion {
  id: string
  suggestion_type: 'equivalency' | 'exclusion' | 'correction'
  ingredient_1: string
  ingredient_2?: string
  occurrence_count: number
  confidence_score: number
  status: 'pending' | 'approved' | 'rejected' | 'needs_info'
  reviewed_by?: string
  reviewed_at?: string
  review_notes?: string
  created_at: string
}

interface MatchFeedback {
  id: string
  recipe_ingredient: string
  matched_product_name: string
  is_correct: boolean
  feedback_type: string
  user_feedback?: string
  confidence_score?: number
  match_type?: string
  created_at: string
}

export default function IngredientRulesAdmin() {
  const [currentTab, setCurrentTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  // Data states
  const [rules, setRules] = useState<IngredientRule[]>([])
  const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([])
  const [feedback, setFeedback] = useState<MatchFeedback[]>([])
  const [metrics, setMetrics] = useState<any>(null)

  // Dialog states
  const [ruleDialog, setRuleDialog] = useState(false)
  const [currentRule, setCurrentRule] = useState<Partial<IngredientRule> | null>(null)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [ruleToDelete, setRuleToDelete] = useState<string | null>(null)

  // Form states for rule editing
  const [editIngredient, setEditIngredient] = useState('')
  const [editRuleType, setEditRuleType] = useState<'equivalency' | 'exclusion' | 'category'>('equivalency')
  const [editEquivalents, setEditEquivalents] = useState<string[]>([])
  const [editExclusions, setEditExclusions] = useState<string[]>([])
  const [editNotes, setEditNotes] = useState('')
  const [editActive, setEditActive] = useState(true)

  // Filter states
  const [searchQuery, setSearchQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'equivalency' | 'exclusion' | 'category'>('all')
  const [showOnlyUnapproved, setShowOnlyUnapproved] = useState(false)

  useEffect(() => {
    checkAdminStatus()
  }, [])

  const checkAdminStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      setUser(session.user)

      // Check if user is a system admin using unified auth
      const adminStatus = await isSystemAdmin(session.user.id)

      if (adminStatus) {
        setIsAdmin(true)
        loadAllData()
      } else {
        setIsAdmin(false)
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }

  const loadAllData = async () => {
    setLoading(true)
    await Promise.all([
      loadRules(),
      loadSuggestions(),
      loadFeedback(),
      loadMetrics()
    ])
    setLoading(false)
  }

  const loadRules = async () => {
    const { data, error } = await supabase
      .from('ingredient_rules')
      .select('*')
      .order('ingredient_name')

    if (!error && data) {
      setRules(data)
    }
  }

  const loadSuggestions = async () => {
    const { data, error } = await supabase
      .from('ingredient_rule_suggestions')
      .select('*')
      .eq('status', 'pending')
      .order('confidence_score', { ascending: false })

    if (!error && data) {
      setSuggestions(data)
    }
  }

  const loadFeedback = async () => {
    const { data, error } = await supabase
      .from('ingredient_match_feedback')
      .select('*')
      .eq('is_correct', false)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error && data) {
      setFeedback(data)
    }
  }

  const loadMetrics = async () => {
    const { data, error } = await supabase
      .from('ingredient_learning_metrics')
      .select('*')
      .order('metric_date', { ascending: false })
      .limit(30)

    if (!error && data) {
      // Calculate summary metrics
      const summary = {
        totalRules: rules.length,
        activeRules: rules.filter(r => r.is_active).length,
        pendingSuggestions: suggestions.length,
        recentFeedback: feedback.length,
        avgAccuracy: data.find(m => m.metric_type === 'accuracy')?.accuracy_percentage || 0
      }
      setMetrics(summary)
    }
  }

  const handleSaveRule = async () => {
    if (!editIngredient) return

    const ruleData = {
      ingredient_name: editIngredient,
      rule_type: editRuleType,
      equivalents: editRuleType === 'equivalency' ? editEquivalents : null,
      excluded_matches: editRuleType === 'exclusion' ? editExclusions : null,
      is_active: editActive,
      notes: editNotes,
      approved: true,
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
      source: currentRule?.id ? 'admin' : 'admin',
      updated_at: new Date().toISOString()
    }

    if (currentRule?.id) {
      // Update existing rule
      const { error } = await supabase
        .from('ingredient_rules')
        .update(ruleData)
        .eq('id', currentRule.id)

      if (!error) {
        await loadRules()
        handleCloseRuleDialog()
      }
    } else {
      // Create new rule
      const { error } = await supabase
        .from('ingredient_rules')
        .insert({
          ...ruleData,
          created_by: user?.id
        })

      if (!error) {
        await loadRules()
        handleCloseRuleDialog()
      }
    }
  }

  const handleDeleteRule = async () => {
    if (!ruleToDelete) return

    const { error } = await supabase
      .from('ingredient_rules')
      .delete()
      .eq('id', ruleToDelete)

    if (!error) {
      await loadRules()
      setDeleteDialog(false)
      setRuleToDelete(null)
    }
  }

  const handleApproveRule = async (ruleId: string) => {
    const { error } = await supabase
      .from('ingredient_rules')
      .update({
        approved: true,
        approved_by: user?.id,
        approved_at: new Date().toISOString()
      })
      .eq('id', ruleId)

    if (!error) {
      await loadRules()
    }
  }

  const handleApproveSuggestion = async (suggestionId: string, suggestion: RuleSuggestion) => {
    // Create a new rule from the suggestion
    const newRule = {
      ingredient_name: suggestion.ingredient_1,
      rule_type: suggestion.suggestion_type === 'exclusion' ? 'exclusion' : 'equivalency',
      equivalents: suggestion.suggestion_type === 'equivalency' ? [suggestion.ingredient_2!] : null,
      excluded_matches: suggestion.suggestion_type === 'exclusion' ? [suggestion.ingredient_2!] : null,
      is_active: true,
      approved: true,
      approved_by: user?.id,
      approved_at: new Date().toISOString(),
      source: 'ml_generated',
      created_by: user?.id,
      confidence_threshold: suggestion.confidence_score
    }

    const { data: createdRule, error: ruleError } = await supabase
      .from('ingredient_rules')
      .insert(newRule)
      .select()
      .single()

    if (!ruleError && createdRule) {
      // Update suggestion status
      await supabase
        .from('ingredient_rule_suggestions')
        .update({
          status: 'approved',
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          created_rule_id: createdRule.id
        })
        .eq('id', suggestionId)

      await loadSuggestions()
      await loadRules()
    }
  }

  const handleRejectSuggestion = async (suggestionId: string, notes?: string) => {
    await supabase
      .from('ingredient_rule_suggestions')
      .update({
        status: 'rejected',
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        review_notes: notes
      })
      .eq('id', suggestionId)

    await loadSuggestions()
  }

  const handleOpenRuleDialog = (rule?: IngredientRule) => {
    if (rule) {
      setCurrentRule(rule)
      setEditIngredient(rule.ingredient_name)
      setEditRuleType(rule.rule_type)
      setEditEquivalents(rule.equivalents || [])
      setEditExclusions(rule.excluded_matches || [])
      setEditNotes(rule.notes || '')
      setEditActive(rule.is_active)
    } else {
      setCurrentRule(null)
      setEditIngredient('')
      setEditRuleType('equivalency')
      setEditEquivalents([])
      setEditExclusions([])
      setEditNotes('')
      setEditActive(true)
    }
    setRuleDialog(true)
  }

  const handleCloseRuleDialog = () => {
    setRuleDialog(false)
    setCurrentRule(null)
  }

  const exportRules = () => {
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      rules: rules.filter(r => r.is_active && r.approved)
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ingredient-rules-${format(new Date(), 'yyyy-MM-dd')}.json`
    a.click()
  }

  // Filter rules based on search and filters
  const filteredRules = rules.filter(rule => {
    if (searchQuery && !rule.ingredient_name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    if (filterType !== 'all' && rule.rule_type !== filterType) {
      return false
    }
    if (showOnlyUnapproved && rule.approved) {
      return false
    }
    return true
  })

  if (loading) {
    return (
      <Container>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </Container>
    )
  }

  if (!isAdmin) {
    return (
      <Container>
        <Alert severity="error" sx={{ mt: 4 }}>
          You do not have permission to access this page. Admin access required.
        </Alert>
      </Container>
    )
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <AdminNav />
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Ingredient Rules Management
        </Typography>
        <Box>
          <Button
            startIcon={<RefreshIcon />}
            onClick={loadAllData}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button
            startIcon={<DownloadIcon />}
            onClick={exportRules}
            sx={{ mr: 1 }}
          >
            Export
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenRuleDialog()}
          >
            Add Rule
          </Button>
        </Box>
      </Box>

      {/* Metrics Summary */}
      {metrics && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Rules
                </Typography>
                <Typography variant="h5">
                  {metrics.totalRules}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Active Rules
                </Typography>
                <Typography variant="h5">
                  {metrics.activeRules}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Pending Review
                </Typography>
                <Typography variant="h5" color="warning.main">
                  {metrics.pendingSuggestions}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Recent Feedback
                </Typography>
                <Typography variant="h5" color="error.main">
                  {metrics.recentFeedback}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Accuracy
                </Typography>
                <Typography variant="h5" color="success.main">
                  {metrics.avgAccuracy.toFixed(1)}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Paper sx={{ width: '100%' }}>
        <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)}>
          <Tab
            label={
              <Badge badgeContent={filteredRules.length} color="primary">
                Rules
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={suggestions.length} color="warning">
                Suggestions
              </Badge>
            }
          />
          <Tab
            label={
              <Badge badgeContent={feedback.length} color="error">
                Feedback
              </Badge>
            }
          />
        </Tabs>

        {/* Rules Tab */}
        {currentTab === 0 && (
          <Box p={3}>
            {/* Filters */}
            <Box display="flex" gap={2} mb={2}>
              <TextField
                placeholder="Search ingredients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
                }}
                sx={{ flexGrow: 1, maxWidth: 400 }}
              />
              <FormControl sx={{ minWidth: 150 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  label="Type"
                >
                  <MenuItem value="all">All Types</MenuItem>
                  <MenuItem value="equivalency">Equivalency</MenuItem>
                  <MenuItem value="exclusion">Exclusion</MenuItem>
                  <MenuItem value="category">Category</MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={
                  <Switch
                    checked={showOnlyUnapproved}
                    onChange={(e) => setShowOnlyUnapproved(e.target.checked)}
                  />
                }
                label="Unapproved Only"
              />
            </Box>

            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Ingredient</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Rules</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredRules.map(rule => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <Typography variant="body1" fontWeight="medium">
                          {rule.ingredient_name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={rule.rule_type}
                          size="small"
                          color={
                            rule.rule_type === 'equivalency' ? 'primary' :
                            rule.rule_type === 'exclusion' ? 'error' :
                            'default'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {rule.rule_type === 'equivalency' && rule.equivalents && (
                          <Box display="flex" flexWrap="wrap" gap={0.5}>
                            {rule.equivalents.slice(0, 3).map((eq, i) => (
                              <Chip key={i} label={eq} size="small" variant="outlined" />
                            ))}
                            {rule.equivalents.length > 3 && (
                              <Chip label={`+${rule.equivalents.length - 3} more`} size="small" />
                            )}
                          </Box>
                        )}
                        {rule.rule_type === 'exclusion' && rule.excluded_matches && (
                          <Box display="flex" flexWrap="wrap" gap={0.5}>
                            {rule.excluded_matches.slice(0, 3).map((ex, i) => (
                              <Chip key={i} label={ex} size="small" variant="outlined" color="error" />
                            ))}
                            {rule.excluded_matches.length > 3 && (
                              <Chip label={`+${rule.excluded_matches.length - 3} more`} size="small" />
                            )}
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={0.5}>
                          {rule.is_active && (
                            <Chip label="Active" size="small" color="success" />
                          )}
                          {rule.approved ? (
                            <Chip label="Approved" size="small" color="primary" />
                          ) : (
                            <Chip label="Pending" size="small" color="warning" />
                          )}
                          {rule.is_system_default && (
                            <Chip label="System" size="small" variant="outlined" />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {rule.source}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" gap={0.5}>
                          {!rule.approved && (
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleApproveRule(rule.id)}
                              title="Approve"
                            >
                              <CheckIcon />
                            </IconButton>
                          )}
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleOpenRuleDialog(rule)}
                            title="Edit"
                          >
                            <EditIcon />
                          </IconButton>
                          {!rule.is_system_default && (
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                setRuleToDelete(rule.id)
                                setDeleteDialog(true)
                              }}
                              title="Delete"
                            >
                              <DeleteIcon />
                            </IconButton>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Suggestions Tab */}
        {currentTab === 1 && (
          <Box p={3}>
            <List>
              {suggestions.map(suggestion => (
                <ListItem key={suggestion.id} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, mb: 1 }}>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body1" fontWeight="medium">
                          {suggestion.ingredient_1}
                        </Typography>
                        <Typography variant="body1">
                          {suggestion.suggestion_type === 'exclusion' ? '≠' : '='}
                        </Typography>
                        <Typography variant="body1" fontWeight="medium">
                          {suggestion.ingredient_2}
                        </Typography>
                        <Chip
                          label={`${(suggestion.confidence_score * 100).toFixed(0)}% confidence`}
                          size="small"
                          color={suggestion.confidence_score > 0.7 ? 'success' : 'warning'}
                        />
                        <Chip
                          label={`${suggestion.occurrence_count} reports`}
                          size="small"
                        />
                      </Box>
                    }
                    secondary={`Suggested ${format(new Date(suggestion.created_at), 'MMM d, yyyy')}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      color="success"
                      onClick={() => handleApproveSuggestion(suggestion.id, suggestion)}
                      title="Approve"
                    >
                      <CheckIcon />
                    </IconButton>
                    <IconButton
                      color="error"
                      onClick={() => handleRejectSuggestion(suggestion.id)}
                      title="Reject"
                    >
                      <CloseIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
              {suggestions.length === 0 && (
                <Typography color="textSecondary" align="center" sx={{ py: 4 }}>
                  No pending suggestions
                </Typography>
              )}
            </List>
          </Box>
        )}

        {/* Feedback Tab */}
        {currentTab === 2 && (
          <Box p={3}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Recipe Ingredient</TableCell>
                    <TableCell>Matched As</TableCell>
                    <TableCell>Feedback</TableCell>
                    <TableCell>User Comments</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {feedback.map(fb => (
                    <TableRow key={fb.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {fb.recipe_ingredient}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="error">
                          {fb.matched_product_name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {fb.feedback_type === 'thumbs_down' ? (
                          <ThumbDownIcon color="error" fontSize="small" />
                        ) : (
                          <ThumbUpIcon color="success" fontSize="small" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {fb.user_feedback || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">
                          {format(new Date(fb.created_at), 'MMM d')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>

      {/* Rule Edit Dialog */}
      <Dialog open={ruleDialog} onClose={handleCloseRuleDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {currentRule ? 'Edit Rule' : 'Add New Rule'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} sx={{ mt: 2 }}>
            <TextField
              label="Ingredient Name"
              value={editIngredient}
              onChange={(e) => setEditIngredient(e.target.value)}
              fullWidth
              required
            />

            <FormControl fullWidth>
              <InputLabel>Rule Type</InputLabel>
              <Select
                value={editRuleType}
                onChange={(e) => setEditRuleType(e.target.value as any)}
                label="Rule Type"
              >
                <MenuItem value="equivalency">Equivalency (matches)</MenuItem>
                <MenuItem value="exclusion">Exclusion (doesn't match)</MenuItem>
                <MenuItem value="category">Category</MenuItem>
              </Select>
            </FormControl>

            {editRuleType === 'equivalency' && (
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={editEquivalents}
                onChange={(e, v) => setEditEquivalents(v)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Equivalent Ingredients"
                    placeholder="Press Enter to add"
                    helperText="List all ingredients that are equivalent to this one"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      label={option}
                      {...getTagProps({ index })}
                    />
                  ))
                }
              />
            )}

            {editRuleType === 'exclusion' && (
              <Autocomplete
                multiple
                freeSolo
                options={[]}
                value={editExclusions}
                onChange={(e, v) => setEditExclusions(v)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Excluded Matches"
                    placeholder="Press Enter to add"
                    helperText="List ingredients that should NOT match with this one"
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      variant="outlined"
                      color="error"
                      label={option}
                      {...getTagProps({ index })}
                    />
                  ))
                }
              />
            )}

            <TextField
              label="Notes"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              multiline
              rows={2}
              fullWidth
            />

            <FormControlLabel
              control={
                <Switch
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseRuleDialog}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveRule}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Delete Rule</DialogTitle>
        <DialogContent>
          Are you sure you want to delete this rule? This action cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteRule}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}