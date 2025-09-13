import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const upc = searchParams.get('upc')

  if (!upc) {
    return NextResponse.json(
      { error: 'UPC parameter is required' },
      { status: 400 }
    )
  }

  try {
    // Make the request from the server side to bypass CORS
    const apiUrl = process.env.NEXT_PUBLIC_BARCODE_API_URL || 'https://api.upcitemdb.com'
    const response = await fetch(`${apiUrl}/prod/trial/lookup?upc=${upc}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`)
    }

    const data = await response.json()

    // Return the API response
    return NextResponse.json(data)

  } catch (error) {
    console.error('Barcode lookup error:', error)
    return NextResponse.json(
      {
        error: 'Failed to lookup barcode',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}