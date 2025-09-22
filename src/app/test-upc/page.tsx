'use client'

import { useState } from 'react'
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Paper,
  CircularProgress,
  Alert
} from '@mui/material'

export default function TestUPCPage() {
  const [upc, setUpc] = useState('')
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleLookup = async () => {
    if (!upc.trim()) {
      setError('Please enter a UPC code')
      return
    }

    setLoading(true)
    setError(null)
    setData(null)

    try {
      const response = await fetch(`/api/barcode/lookup?upc=${upc}`)
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`)
      }

      const result = await response.json()
      setData(result)

      // Log to console for easier inspection
      console.log('Full UPC API Response:', result)

      // Log specific item data if available
      if (result.items && result.items.length > 0) {
        console.log('First Item Details:', result.items[0])

        // List all available fields
        const fields = Object.keys(result.items[0])
        console.log('Available fields:', fields)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to lookup UPC')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Typography variant="h4" gutterBottom>
          UPC API Data Inspector
        </Typography>

        <Typography variant="body2" color="textSecondary" paragraph>
          Enter a UPC code to see all the data returned from the API
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <TextField
            label="UPC Code"
            value={upc}
            onChange={(e) => setUpc(e.target.value)}
            placeholder="e.g., 078742370903"
            sx={{ flex: 1 }}
          />
          <Button
            variant="contained"
            onClick={handleLookup}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Lookup'}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {data && (
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              API Response:
            </Typography>

            {data.items && data.items.length > 0 ? (
              <>
                <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                  Product Found - Available Fields:
                </Typography>

                <Box component="pre" sx={{
                  bgcolor: 'grey.100',
                  p: 2,
                  borderRadius: 1,
                  overflowX: 'auto',
                  fontSize: '0.875rem'
                }}>
                  {Object.entries(data.items[0]).map(([key, value]) => (
                    <div key={key}>
                      <strong>{key}:</strong> {JSON.stringify(value, null, 2)}
                    </div>
                  ))}
                </Box>

                <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
                  Fields we currently capture:
                </Typography>
                <ul>
                  <li>title/description → name</li>
                  <li>brand</li>
                  <li>category</li>
                  <li>images[0] → image_url</li>
                  <li>upc</li>
                </ul>

                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
                  Additional fields available but not captured:
                </Typography>
                <ul>
                  {data.items[0].size && <li>size: {data.items[0].size}</li>}
                  {data.items[0].weight && <li>weight: {data.items[0].weight}</li>}
                  {data.items[0].dimension && <li>dimension: {JSON.stringify(data.items[0].dimension)}</li>}
                  {data.items[0].nutrition && <li>nutrition: Available</li>}
                  {data.items[0].ingredients && <li>ingredients: {data.items[0].ingredients}</li>}
                  {data.items[0].color && <li>color: {data.items[0].color}</li>}
                  {data.items[0].model && <li>model: {data.items[0].model}</li>}
                  {data.items[0].asin && <li>asin (Amazon ID): {data.items[0].asin}</li>}
                  {data.items[0].elid && <li>elid (eBay ID): {data.items[0].elid}</li>}
                </ul>
              </>
            ) : (
              <Typography>No items found in response</Typography>
            )}

            <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
              Full Raw Response:
            </Typography>
            <Box component="pre" sx={{
              bgcolor: 'grey.100',
              p: 2,
              borderRadius: 1,
              overflowX: 'auto',
              fontSize: '0.75rem',
              maxHeight: '400px',
              overflowY: 'auto'
            }}>
              {JSON.stringify(data, null, 2)}
            </Box>
          </Paper>
        )}
      </Box>
    </Container>
  )
}