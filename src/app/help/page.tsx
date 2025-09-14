'use client'

import { useState } from 'react'
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  Divider,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepContent
} from '@mui/material'
import {
  ExpandMore as ExpandMoreIcon,
  Help as HelpIcon,
  Kitchen as PantryIcon,
  QrCodeScanner as ScanIcon,
  Restaurant as RecipeIcon,
  ShoppingCart as ShoppingIcon,
  Inventory as InventoryIcon,
  SmartToy as AIIcon,
  Receipt as ReceiptIcon,
  Group as HouseholdIcon,
  Star as FeaturesIcon,
  Timeline as RoadmapIcon,
  CheckCircle as CheckIcon,
  ArrowForward as NextIcon,
  PlayArrow as StartIcon
} from '@mui/icons-material'
import { useRouter } from 'next/navigation'

export default function HelpPage() {
  const router = useRouter()
  const [setupOpen, setSetupOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  const helpSections = [
    {
      title: "🏠 Getting Started",
      icon: <HouseholdIcon />,
      sections: [
        {
          question: "How do I set up my household?",
          answer: "Name your household, invite family members, and configure your storage locations. You can start with general locations and customize later."
        },
        {
          question: "What are storage locations?",
          answer: "Organize your pantries, freezers, shelves, and sections. Print QR codes to attach to each location for instant scanning access."
        },
        {
          question: "Can I skip detailed setup?",
          answer: "Yes! Start with default locations (Main Pantry, Main Freezer, Main Refrigerator) and customize as you go."
        }
      ]
    },
    {
      title: "📦 Stock Up (Adding Items)",
      icon: <ScanIcon />,
      sections: [
        {
          question: "How does Stock Up work?",
          answer: "Three ways to add items: 1) Search existing products, 2) Scan barcodes, 3) Use AI visual recognition. Perfect for putting groceries away efficiently."
        },
        {
          question: "What is Put Groceries Away mode?",
          answer: "Continuous mode that remembers your last storage location and automatically reopens the scanner after each item. Perfect for bulk grocery sessions."
        },
        {
          question: "How does AI recognition work?",
          answer: "Point your camera at any grocery item and AI identifies it instantly. Great for produce, bulk items, or damaged barcodes."
        }
      ]
    },
    {
      title: "🏃 Grab & Go (Using Items)",
      icon: <InventoryIcon />,
      sections: [
        {
          question: "How do I track item usage?",
          answer: "Two workflows: 1) Item-first: Scan product, choose location if multiple. 2) Location-first: Scan location QR, select item. Automatically uses FIFO (oldest first)."
        },
        {
          question: "What happens when I use items?",
          answer: "Quantities are reduced or items marked as consumed. Complete audit trail tracks who used what, when, and from where."
        },
        {
          question: "Can I adjust quantities?",
          answer: "Yes! Touch-friendly number pad lets you remove exact quantities. 'Use All' button for complete consumption."
        }
      ]
    },
    {
      title: "🍳 Recipe Intelligence",
      icon: <RecipeIcon />,
      sections: [
        {
          question: "How do recipes work with my pantry?",
          answer: "Recipes show real-time ingredient availability with green ✓, yellow ⚠️, or red ✗ icons. Smart ingredient matching knows your sea salt = salt."
        },
        {
          question: "What are recipe import options?",
          answer: "Three ways: 1) Import from YouTube/recipe websites, 2) Scan recipe photos with AI, 3) Create manually. AI extracts ingredients and instructions."
        },
        {
          question: "How does recipe cooking work?",
          answer: "'Make This Recipe' actually removes ingredients from your pantry using FIFO. Tracks cooking history and recipe popularity."
        },
        {
          question: "What are Natural Substitutions?",
          answer: "AI-powered ingredient substitutions that understand context. Get suggestions like ground turkey for ground beef with cooking tips and ratios."
        }
      ]
    },
    {
      title: "🛒 Shopping Lists",
      icon: <ShoppingIcon />,
      sections: [
        {
          question: "How do shopping lists integrate?",
          answer: "Auto-generate from low inventory, add missing recipe ingredients, or create manually. Share lists with household members."
        },
        {
          question: "What are list sharing options?",
          answer: "Private (only you), Shared with Select Members, or Shared with All. Set different permission levels for each family member."
        },
        {
          question: "How does recipe integration work?",
          answer: "Recipe pages show missing ingredients with checkboxes. Select what you need and add directly to your shopping list."
        }
      ]
    },
    {
      title: "🤖 AI Features",
      icon: <AIIcon />,
      sections: [
        {
          question: "What AI features are available?",
          answer: "Visual item recognition, recipe photo scanning, smart substitutions, and recipe import from any website. Uses your Claude and Gemini accounts."
        },
        {
          question: "How is AI usage tracked?",
          answer: "Complete token tracking and billing with daily/monthly limits. Free tier included. View usage in Settings → AI Usage & Billing."
        },
        {
          question: "Can I correct AI mistakes?",
          answer: "Yes! Thumbs up/down feedback helps AI learn. Manual entry always available as backup."
        }
      ]
    },
    {
      title: "🚀 Coming Soon",
      icon: <RoadmapIcon />,
      sections: [
        {
          question: "Store Account Connections",
          answer: "Connect Walmart, Target, Kroger accounts to automatically import receipts and enable direct curbside ordering from the app."
        },
        {
          question: "Budget & Meal Planning",
          answer: "Comprehensive budget tracking with spending patterns, meal planning with automated shopping lists, and cost optimization suggestions."
        },
        {
          question: "Advanced Analytics",
          answer: "Food waste tracking, inventory turnover analysis, recipe cost calculations, and household eating pattern insights."
        }
      ]
    }
  ]

  const setupSteps = [
    {
      title: "Name Your Household",
      description: "Give your household a memorable name like 'The Smith Family' or 'Our Kitchen'",
      action: () => router.push('/settings/household'),
      icon: <HouseholdIcon />
    },
    {
      title: "Configure Storage",
      description: "Set up your pantries, freezers, and shelves. You can start simple and add details later.",
      action: () => router.push('/settings/storage'),
      icon: <PantryIcon />
    },
    {
      title: "Try Stock Up",
      description: "Add your first items using barcode scanning, AI recognition, or manual entry.",
      action: () => router.push('/inventory/quick-add'),
      icon: <ScanIcon />
    },
    {
      title: "Import a Recipe",
      description: "Try importing a recipe from YouTube or a recipe website to see inventory integration.",
      action: () => router.push('/recipes'),
      icon: <RecipeIcon />
    },
    {
      title: "Create Shopping List",
      description: "Generate shopping lists from low inventory or missing recipe ingredients.",
      action: () => router.push('/shopping'),
      icon: <ShoppingIcon />
    }
  ]

  return (
    <Container maxWidth="lg" sx={{ mt: 4 }}>
      <Box display="flex" alignItems="center" mb={4}>
        <HelpIcon sx={{ mr: 2, fontSize: 32, color: 'primary.main' }} />
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            PantryIQ Help & Documentation
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Complete guide to your intelligent kitchen management system
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<StartIcon />}
          onClick={() => setSetupOpen(true)}
          color="primary"
          size="large"
        >
          Quick Setup Guide
        </Button>
      </Box>

      {/* Feature Overview */}
      <Alert severity="info" sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          🧠 Welcome to PantryIQ - Where Modern Efficiency Meets Traditional Preparedness
        </Typography>
        <Typography variant="body2">
          Your complete kitchen intelligence system with AI-powered recognition, smart inventory tracking,
          recipe management, and household collaboration. Everything you need to eliminate food waste and
          optimize your kitchen operations.
        </Typography>
      </Alert>

      {/* Help Sections */}
      <Grid container spacing={3}>
        {helpSections.map((section, index) => (
          <Grid item xs={12} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" mb={2}>
                  {section.icon}
                  <Typography variant="h6" sx={{ ml: 1 }}>
                    {section.title}
                  </Typography>
                </Box>

                {section.sections.map((item, itemIndex) => (
                  <Accordion key={itemIndex}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="body1" fontWeight="medium">
                        {item.question}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="body2" color="textSecondary">
                        {item.answer}
                      </Typography>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Quick Setup Modal */}
      {setupOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Paper
            sx={{
              maxWidth: 600,
              width: '90%',
              maxHeight: '90vh',
              overflow: 'auto',
              p: 4
            }}
          >
            <Typography variant="h5" gutterBottom align="center">
              🚀 PantryIQ Quick Setup
            </Typography>
            <Typography variant="body2" color="textSecondary" align="center" sx={{ mb: 3 }}>
              Get your intelligent kitchen up and running in 5 easy steps
            </Typography>

            <Stepper activeStep={currentStep} orientation="vertical">
              {setupSteps.map((step, index) => (
                <Step key={index}>
                  <StepLabel icon={step.icon}>
                    <Typography variant="h6">{step.title}</Typography>
                  </StepLabel>
                  <StepContent>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      {step.description}
                    </Typography>
                    <Box>
                      <Button
                        variant="contained"
                        onClick={step.action}
                        startIcon={<NextIcon />}
                        sx={{ mr: 1 }}
                      >
                        Go to {step.title}
                      </Button>
                      <Button
                        onClick={() => setCurrentStep(Math.min(currentStep + 1, setupSteps.length - 1))}
                        disabled={currentStep >= setupSteps.length - 1}
                      >
                        Skip
                      </Button>
                    </Box>
                  </StepContent>
                </Step>
              ))}
            </Stepper>

            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Button
                variant="outlined"
                onClick={() => setSetupOpen(false)}
                size="large"
              >
                Close Setup Guide
              </Button>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Feature Highlights */}
      <Card sx={{ mt: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            ✨ Key Features & Capabilities
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <ScanIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                <Typography variant="body1" fontWeight="medium">Smart Scanning</Typography>
                <Typography variant="caption" color="textSecondary">
                  Barcode, QR codes, and AI visual recognition
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <RecipeIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                <Typography variant="body1" fontWeight="medium">Recipe Intelligence</Typography>
                <Typography variant="caption" color="textSecondary">
                  Import, scan photos, smart substitutions
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <HouseholdIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
                <Typography variant="body1" fontWeight="medium">Family Sharing</Typography>
                <Typography variant="caption" color="textSecondary">
                  Household collaboration and permissions
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Roadmap */}
      <Card sx={{ mt: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            🛣️ Future Roadmap
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <Chip label="Coming Soon" color="primary" size="small" />
              </ListItemIcon>
              <ListItemText
                primary="Store Account Integration"
                secondary="Connect Walmart, Target, Kroger for automatic receipt import and curbside ordering"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Chip label="In Development" color="secondary" size="small" />
              </ListItemIcon>
              <ListItemText
                primary="Budget & Meal Planning"
                secondary="Spending tracking, meal planning automation, and cost optimization"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Chip label="Planned" color="info" size="small" />
              </ListItemIcon>
              <ListItemText
                primary="Advanced Analytics"
                secondary="Food waste insights, inventory turnover analysis, and eating pattern tracking"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>
    </Container>
  )
}