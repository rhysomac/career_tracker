param([int]$Port = 8080)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Output "Website running at http://localhost:$Port/ (Ctrl+C to stop)"
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        try {
            $relative = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath).TrimStart('/').Replace('/', '\')
            if (-not $relative) { $relative = 'index.html' }
            $path = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $relative))
            $types = @{ '.html' = 'text/html'; '.js' = 'text/javascript'; '.css' = 'text/css'; '.jpg' = 'image/jpeg'; '.png' = 'image/png' }
            $extension = [IO.Path]::GetExtension($path).ToLowerInvariant()
            if (-not $path.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase) -or -not $types.ContainsKey($extension) -or -not [IO.File]::Exists($path)) {
                $context.Response.StatusCode = 404
            } else {
                $bytes = [IO.File]::ReadAllBytes($path)
                $context.Response.ContentType = $types[$extension] + '; charset=utf-8'
                $context.Response.ContentLength64 = $bytes.Length
                $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
            }
        } catch {
            Write-Warning $_
            $context.Response.StatusCode = 500
        } finally {
            $context.Response.Close()
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
