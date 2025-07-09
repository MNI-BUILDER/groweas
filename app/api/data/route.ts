import { type NextRequest, NextResponse } from "next/server"

// In-memory storage for our data
let currentData: any = null
let lastUpdateTime = 0
let dataVersion = 0 // Track data versions to detect changes

// Configuration
const DATA_TIMEOUT_SECONDS = 30 // Clear data after 30 seconds of no updates

// API keys configuration
const API_KEYS = {
  MASTER_KEY: "GAMERSBERGGAG", // Master key with full access (used by the Roblox script)
  READ_ONLY_KEYS: ["ERICKDABOSS", "USER_KEY_2", "USER_KEY_3"],
}

// Function to check if data has expired and clear it if needed
function checkAndClearExpiredData() {
  if (currentData && lastUpdateTime > 0) {
    const currentTime = Math.floor(Date.now() / 1000)
    const timeSinceLastUpdate = currentTime - lastUpdateTime

    if (timeSinceLastUpdate >= DATA_TIMEOUT_SECONDS) {
      console.log(`Data expired after ${timeSinceLastUpdate} seconds. Clearing data...`)
      currentData = null
      lastUpdateTime = 0
      dataVersion++ // Increment version to track this change
      return true // Data was cleared
    }
  }
  return false // Data is still valid or no data exists
}

// Authentication middleware function
function authenticate(request: NextRequest, requireMasterKey = false) {
  // Get the API key directly from the Authorization header
  const apiKey = request.headers.get("Authorization")

  // Check if Authorization header exists
  if (!apiKey) {
    return {
      authenticated: false,
      response: NextResponse.json({ success: false, message: "Missing API key" }, { status: 401 }),
    }
  }

  // Check if it's the master key
  if (apiKey === API_KEYS.MASTER_KEY) {
    return { authenticated: true }
  }

  // If master key is required but not provided, return unauthorized
  if (requireMasterKey) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { success: false, message: "Insufficient permissions. Master key required." },
        { status: 403 },
      ),
    }
  }

  // Check if it's a read-only key
  if (API_KEYS.READ_ONLY_KEYS.includes(apiKey)) {
    return { authenticated: true, readOnly: true }
  }

  // If no valid key is found
  return {
    authenticated: false,
    response: NextResponse.json({ success: false, message: "Invalid API key" }, { status: 401 }),
  }
}

// GET - Fetch data
export async function GET(request: NextRequest) {
  // Check and clear expired data before responding
  const dataWasCleared = checkAndClearExpiredData()

  // Check for the special status query parameter
  const url = new URL(request.url)
  const keyParam = url.searchParams.get("key")

  // Calculate time since last update for status info
  const currentTime = Math.floor(Date.now() / 1000)
  const timeSinceLastUpdate = lastUpdateTime > 0 ? currentTime - lastUpdateTime : 0

  // Prepare the response data
  const responseData = {
    success: true,
    message: dataWasCleared ? "API is online (data was auto-cleared due to timeout)" : "API is online",
    data: currentData ? [currentData] : [],
    meta: {
      lastUpdateTime: lastUpdateTime,
      timeSinceLastUpdate: timeSinceLastUpdate,
      dataTimeout: DATA_TIMEOUT_SECONDS,
      dataExpired: dataWasCleared,
      dataVersion: dataVersion,
      serverTime: currentTime,
    },
  }

  // If key=status is provided, bypass authentication
  if (keyParam === "status") {
    // Create response with no-cache headers
    const response = NextResponse.json(responseData)

    // Add cache control headers to prevent caching
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("Expires", "0")
    response.headers.set("Surrogate-Control", "no-store")

    return response
  }

  // Otherwise, proceed with normal authentication
  const auth = authenticate(request)
  if (!auth.authenticated) {
    return auth.response
  }

  // Create response with no-cache headers
  const response = NextResponse.json(responseData)

  // Add cache control headers to prevent caching
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
  response.headers.set("Pragma", "no-cache")
  response.headers.set("Expires", "0")
  response.headers.set("Surrogate-Control", "no-store")

  return response
}

// POST - Add new data
export async function POST(request: NextRequest) {
  // Check and clear expired data before processing
  checkAndClearExpiredData()

  // Authenticate the request
  const auth = authenticate(request, false)
  if (!auth.authenticated) {
    return auth.response
  }

  // Check if read-only key is trying to modify data
  if (auth.readOnly) {
    return NextResponse.json({ success: false, message: "Read-only API key cannot modify data" }, { status: 403 })
  }

  try {
    const body = await request.json()

    // Add timestamp if not present
    if (!body.timestamp) {
      body.timestamp = Math.floor(Date.now() / 1000)
    }

    // Always replace the current data with the new data
    currentData = body
    lastUpdateTime = Math.floor(Date.now() / 1000) // Update the last update time
    dataVersion++ // Increment version to track this change
    console.log("Data updated with new submission at timestamp:", lastUpdateTime, "version:", dataVersion)

    // Create response with no-cache headers
    const response = NextResponse.json({
      success: true,
      message: "Data updated successfully",
      data: [], // Empty array in response as requested
      meta: {
        dataVersion: dataVersion,
        lastUpdateTime: lastUpdateTime,
      },
    })

    // Add cache control headers to prevent caching
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("Expires", "0")
    response.headers.set("Surrogate-Control", "no-store")

    return response
  } catch (error) {
    console.error("Error processing request:", error)
    return NextResponse.json({ success: false, message: "Failed to process data" }, { status: 400 })
  }
}

// PUT - Update data in the array (no ID required)
export async function PUT(request: NextRequest) {
  // Check and clear expired data before processing
  checkAndClearExpiredData()

  // Authenticate the request with master key requirement
  const auth = authenticate(request, true)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const body = await request.json()

    // Always replace the current data
    currentData = body
    lastUpdateTime = Math.floor(Date.now() / 1000) // Update the last update time
    dataVersion++ // Increment version to track this change

    // Create response with no-cache headers
    const response = NextResponse.json({
      success: true,
      message: "Data updated successfully",
      data: [],
      meta: {
        dataVersion: dataVersion,
        lastUpdateTime: lastUpdateTime,
      },
    })

    // Add cache control headers to prevent caching
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("Expires", "0")
    response.headers.set("Surrogate-Control", "no-store")

    return response
  } catch (error) {
    return NextResponse.json({ success: false, message: "Failed to update data" }, { status: 500 })
  }
}

// DELETE - Remove data from the array (no ID required)
export async function DELETE(request: NextRequest) {
  // Authenticate the request with master key requirement
  const auth = authenticate(request, true)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    if (!currentData) {
      return NextResponse.json(
        {
          success: false,
          message: "No data to delete",
        },
        { status: 404 },
      )
    }

    // Clear the current data
    currentData = null
    lastUpdateTime = 0
    dataVersion++ // Increment version to track this change

    // Create response with no-cache headers
    const response = NextResponse.json({
      success: true,
      message: "All data deleted successfully",
      data: [],
      meta: {
        dataVersion: dataVersion,
        lastUpdateTime: lastUpdateTime,
      },
    })

    // Add cache control headers to prevent caching
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("Expires", "0")
    response.headers.set("Surrogate-Control", "no-store")

    return response
  } catch (error) {
    return NextResponse.json({ success: false, message: "Failed to delete data" }, { status: 500 })
  }
}

// PATCH - Partially update data
export async function PATCH(request: NextRequest) {
  // Check and clear expired data before processing
  checkAndClearExpiredData()

  // Authenticate the request with master key requirement
  const auth = authenticate(request, true)
  if (!auth.authenticated) {
    return auth.response
  }

  try {
    const updates = await request.json()

    if (!currentData) {
      return NextResponse.json(
        {
          success: false,
          message: "No data to update",
        },
        { status: 404 },
      )
    }

    // Apply partial updates to the current data
    currentData = { ...currentData, ...updates }
    lastUpdateTime = Math.floor(Date.now() / 1000) // Update the last update time
    dataVersion++ // Increment version to track this change

    // Create response with no-cache headers
    const response = NextResponse.json({
      success: true,
      message: "Data partially updated successfully",
      data: [],
      meta: {
        dataVersion: dataVersion,
        lastUpdateTime: lastUpdateTime,
      },
    })

    // Add cache control headers to prevent caching
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate")
    response.headers.set("Pragma", "no-cache")
    response.headers.set("Expires", "0")
    response.headers.set("Surrogate-Control", "no-store")

    return response
  } catch (error) {
    return NextResponse.json({ success: false, message: "Failed to update data" }, { status: 500 })
  }
}
