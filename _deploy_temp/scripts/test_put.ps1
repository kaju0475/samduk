
$headers = @{ "Content-Type" = "application/json" }
$body = @{
    id          = "C1768578467547-s1up7"
    name        = "(주)MS 인천가스"
    paymentType = "cash"
    fax         = "123-456"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Method Put -Uri "http://localhost:3000/api/master/customers" -Headers $headers -Body $body -ErrorAction Stop
    $response | ConvertTo-Json | Out-File -FilePath update_result.json -Encoding utf8
}
catch {
    $_.Exception.Response.GetResponseStream() | % { 
        $reader = New-Object System.IO.StreamReader($_, [System.Text.Encoding]::UTF8)
        $reader.ReadToEnd() | Out-File -FilePath update_error.json -Encoding utf8
    }
}
