$url = 'https://sgcmdjotzsfbdoajduuc.supabase.co/rest/v1/tanism_store?limit=5'
$key = 'sb_publishable_9EbHslLuEK2Q5WnRsyzEUw_dRAD-x-H'
try {
  $r = Invoke-WebRequest -Uri $url -Headers @{ apikey=$key; Authorization="Bearer $key" } -ErrorAction Stop
  Write-Output "STATUS: $($r.StatusCode)"
  Write-Output $r.Content
} catch {
  $e = $_.Exception
  Write-Output "ERROR: $($e.Message)"
  if ($e.Response) {
    $st = $e.Response.GetResponseStream()
    if ($st) { $r2 = New-Object System.IO.StreamReader($st); Write-Output $r2.ReadToEnd() }
  }
}
