// Test script to call the meal planner API directly

async function testMealPlannerAPI() {
  try {
    console.log('Testing meal planner API...')

    const response = await fetch('http://localhost:3000/api/meal-planner/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        householdId: '123e4567-e89b-12d3-a456-426614174000', // Valid UUID format
        startDate: '2025-01-20',
        endDate: '2025-01-26',
        strategy: 'auto',
        options: {},
        usePastMeals: false,
        includeStaples: true
      })
    })

    console.log('Response status:', response.status)

    const data = await response.json()
    console.log('Response data:', JSON.stringify(data, null, 2))

    if (data.success) {
      console.log('✅ Meal plan generated successfully!')
      console.log('Plan ID:', data.planId)
      console.log('Total meals:', data.summary?.totalMeals)
      console.log('Days planned:', data.summary?.daysPlanned)
    } else {
      console.log('❌ Failed to generate meal plan:', data.error)
    }
  } catch (error) {
    console.error('❌ Error calling API:', error)
  }
}

testMealPlannerAPI()