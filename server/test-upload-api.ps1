# PowerShell script to test image upload API
# Usage: .\test-upload-api.ps1

Write-Host "🧪 Testing VarsityHub Upload API..." -ForegroundColor Cyan
Write-Host ""

# Configuration
$API_URL = "http://localhost:3000/api/uploads"
$TEST_IMAGE = "test-image.jpg"

# Check if server is running
Write-Host "📡 Checking if server is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Server is running!" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "❌ Server is not running!" -ForegroundColor Red
    Write-Host "Please start the server first with: npm start" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

# Create a test image if it doesn't exist
if (-Not (Test-Path $TEST_IMAGE)) {
    Write-Host "📸 Creating test image..." -ForegroundColor Yellow
    
    # Create a simple 100x100 red square image using .NET
    Add-Type -AssemblyName System.Drawing
    $bitmap = New-Object System.Drawing.Bitmap(100, 100)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::Red)
    $graphics.DrawString("TEST", (New-Object System.Drawing.Font("Arial", 16)), [System.Drawing.Brushes]::White, 10, 40)
    $graphics.Dispose()
    $bitmap.Save($TEST_IMAGE, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $bitmap.Dispose()
    
    Write-Host "✅ Test image created: $TEST_IMAGE" -ForegroundColor Green
    Write-Host ""
}

# Get auth token (you'll need to replace this with a real token)
Write-Host "🔑 Authentication required!" -ForegroundColor Yellow
Write-Host "Please provide a valid auth token (JWT):" -ForegroundColor Yellow
$TOKEN = Read-Host "Auth Token"

if ([string]::IsNullOrWhiteSpace($TOKEN)) {
    Write-Host "⚠️  No token provided - attempting without auth..." -ForegroundColor Yellow
    Write-Host ""
}

# Upload the image
Write-Host "📤 Uploading test image to $API_URL..." -ForegroundColor Yellow
Write-Host ""

try {
    $headers = @{}
    if (-Not [string]::IsNullOrWhiteSpace($TOKEN)) {
        $headers["Authorization"] = "Bearer $TOKEN"
    }

    $fileBytes = [System.IO.File]::ReadAllBytes($TEST_IMAGE)
    $fileContent = [System.Net.Http.ByteArrayContent]::new($fileBytes)
    $fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse("image/jpeg")

    $multipartContent = [System.Net.Http.MultipartFormDataContent]::new()
    $multipartContent.Add($fileContent, "file", $TEST_IMAGE)

    $httpClient = [System.Net.Http.HttpClient]::new()
    foreach ($key in $headers.Keys) {
        $httpClient.DefaultRequestHeaders.Add($key, $headers[$key])
    }

    $response = $httpClient.PostAsync($API_URL, $multipartContent).Result
    $result = $response.Content.ReadAsStringAsync().Result

    if ($response.IsSuccessStatusCode) {
        Write-Host "✅ Upload successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "📊 Response:" -ForegroundColor Cyan
        Write-Host $result -ForegroundColor White
        Write-Host ""
        Write-Host "🎉 Cloudinary upload is working!" -ForegroundColor Green
    } else {
        Write-Host "❌ Upload failed!" -ForegroundColor Red
        Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Red
        Write-Host "Response: $result" -ForegroundColor Red
    }

    $httpClient.Dispose()

} catch {
    Write-Host "❌ Error during upload!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
Write-Host "🧹 Cleaning up..." -ForegroundColor Yellow
if (Test-Path $TEST_IMAGE) {
    Remove-Item $TEST_IMAGE
    Write-Host "✅ Test image deleted" -ForegroundColor Green
}
