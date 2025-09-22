'use client'

import { useRouter, usePathname } from 'next/navigation'
import {
  Box,
  Tabs,
  Tab,
  Paper,
  Breadcrumbs,
  Typography,
  Link,
  Button
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  Code as RulesIcon,
  Storage as DataIcon,
  Home as HomeIcon,
  NavigateNext as NavigateNextIcon
} from '@mui/icons-material'

const adminPages = [
  { label: 'Dashboard', value: '/admin', icon: DashboardIcon },
  { label: 'Ingredient Rules', value: '/admin/ingredient-rules', icon: RulesIcon },
  { label: 'Data Management', value: '/admin/data-management', icon: DataIcon }
]

export default function AdminNav() {
  const router = useRouter()
  const pathname = usePathname()

  const handleChange = (_event: React.SyntheticEvent, newValue: string) => {
    router.push(newValue)
  }

  const getPageTitle = () => {
    const page = adminPages.find(p => p.value === pathname)
    return page?.label || 'Admin'
  }

  return (
    <Box sx={{ mb: 3 }}>
      <Paper elevation={1} sx={{ px: 3, py: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />}>
            <Link
              component="button"
              variant="body1"
              onClick={() => router.push('/')}
              sx={{
                display: 'flex',
                alignItems: 'center',
                textDecoration: 'none',
                color: 'text.secondary',
                '&:hover': { color: 'primary.main' }
              }}
            >
              <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
              Home
            </Link>
            <Link
              component="button"
              variant="body1"
              onClick={() => router.push('/admin')}
              sx={{
                textDecoration: 'none',
                color: pathname === '/admin' ? 'text.primary' : 'text.secondary',
                '&:hover': { color: 'primary.main' },
                fontWeight: pathname === '/admin' ? 600 : 400
              }}
            >
              Admin
            </Link>
            {pathname !== '/admin' && (
              <Typography color="text.primary" sx={{ fontWeight: 600 }}>
                {getPageTitle()}
              </Typography>
            )}
          </Breadcrumbs>

          <Button
            variant="outlined"
            size="small"
            startIcon={<HomeIcon />}
            onClick={() => router.push('/')}
          >
            Exit Admin
          </Button>
        </Box>

        <Tabs
          value={pathname}
          onChange={handleChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          {adminPages.map((page) => {
            const Icon = page.icon
            return (
              <Tab
                key={page.value}
                label={page.label}
                value={page.value}
                icon={<Icon />}
                iconPosition="start"
                sx={{
                  minHeight: 48,
                  textTransform: 'none',
                  fontSize: '0.95rem'
                }}
              />
            )
          })}
        </Tabs>
      </Paper>
    </Box>
  )
}