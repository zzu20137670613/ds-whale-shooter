# C:\Users\15639732925\Documents\deepseek-harness\default-workspace\whale-shooter\ds-whale-shooter-PC\scripts\swap-story-videos.ps1
# ---------------------------------------------------------------------------
#
#   powershell -File scripts\swap-story-videos.ps1 -Night <path.mp4> -Holding <path.mp4>
#
# Both arguments are optional: anything omitted keeps the file already in public/assets/video.
# The two clips are identified by duration, not by filename, because the WeChat export names are
# hashes (`de364c2dc17e...raw.mp4`) and carry no hint of which clip they are:
#
#
# Refuses a file whose duration is nowhere near its slot, so a mix-up cannot ship silently.
# Prints the resulting dimensions and bitrate; the player letterboxes whatever it is given, so
# 1080p is a drop-in for the old 720p / 528p files.
param(
    [string]$Night,
    [string]$Holding,
    [switch]$Force
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$videoDir = Join-Path $root "public\assets\video"
$targets = @{
    "night-of-dragons.mp4" = @{ Seconds = 67.5; Tolerance = 4.0 }
    "holding-hands.mp4"    = @{ Seconds = 187.5; Tolerance = 6.0 }
}

# Minimal MP4 header reader: mvhd for duration, tkhd for display size. No ffmpeg on this box.
function Get-Mp4Info {
    param([string]$Path)
    $fs = [System.IO.File]::OpenRead($Path)
    try {
        $len = [int][Math]::Min($fs.Length, 8MB)
        $buf = New-Object byte[] $len
        $fs.Read($buf, 0, $len) | Out-Null
    } finally {
        $fs.Dispose()
    }
    $duration = $null
    $size = $null
    $i = 0
    while ($i + 8 -le $len) {
        $boxSize = ([int]$buf[$i] -shl 24) -bor ([int]$buf[$i + 1] -shl 16) -bor ([int]$buf[$i + 2] -shl 8) -bor [int]$buf[$i + 3]
        $type = [System.Text.Encoding]::ASCII.GetString($buf, $i + 4, 4)
        if ($boxSize -lt 8) { break }
        if ($type -eq "moov") {
            $j = $i + 8
            $end = [Math]::Min($i + $boxSize, $len)
            while ($j + 8 -le $end) {
                $s2 = ([int]$buf[$j] -shl 24) -bor ([int]$buf[$j + 1] -shl 16) -bor ([int]$buf[$j + 2] -shl 8) -bor [int]$buf[$j + 3]
                $t2 = [System.Text.Encoding]::ASCII.GetString($buf, $j + 4, 4)
                if ($s2 -lt 8) { break }
                if ($t2 -eq "mvhd") {
                    $ver = $buf[$j + 8]
                    if ($ver -eq 0) {
                        $ts = ([int]$buf[$j + 20] -shl 24) -bor ([int]$buf[$j + 21] -shl 16) -bor ([int]$buf[$j + 22] -shl 8) -bor [int]$buf[$j + 23]
                        $du = ([int]$buf[$j + 24] -shl 24) -bor ([int]$buf[$j + 25] -shl 16) -bor ([int]$buf[$j + 26] -shl 8) -bor [int]$buf[$j + 27]
                    } else {
                        $ts = ([int]$buf[$j + 28] -shl 24) -bor ([int]$buf[$j + 29] -shl 16) -bor ([int]$buf[$j + 30] -shl 8) -bor [int]$buf[$j + 31]
                        $du = 0
                        for ($k = 0; $k -lt 8; $k++) { $du = ($du -shl 8) -bor [int]$buf[$j + 32 + $k] }
                    }
                    if ($ts -gt 0) { $duration = [Math]::Round($du / $ts, 1) }
                }
                if ($t2 -eq "trak") {
                    $k = $j + 8
                    $trakEnd = [Math]::Min($j + $s2, $end)
                    while ($k + 8 -le $trakEnd) {
                        $s3 = ([int]$buf[$k] -shl 24) -bor ([int]$buf[$k + 1] -shl 16) -bor ([int]$buf[$k + 2] -shl 8) -bor [int]$buf[$k + 3]
                        $t3 = [System.Text.Encoding]::ASCII.GetString($buf, $k + 4, 4)
                        if ($s3 -lt 8) { break }
                        if ($t3 -eq "tkhd") {
                            $wOff = $k + $s3 - 8
                            $hOff = $k + $s3 - 4
                            $w = (([int]$buf[$wOff] -shl 24) -bor ([int]$buf[$wOff + 1] -shl 16) -bor ([int]$buf[$wOff + 2] -shl 8) -bor [int]$buf[$wOff + 3]) -shr 16
                            $h = (([int]$buf[$hOff] -shl 24) -bor ([int]$buf[$hOff + 1] -shl 16) -bor ([int]$buf[$hOff + 2] -shl 8) -bor [int]$buf[$hOff + 3]) -shr 16
                            if ($w -gt 0 -and $h -gt 0) { $size = "$w" + "x" + "$h" }
                        }
                        $k += $s3
                    }
                }
                $j += $s2
            }
        }
        $i += $boxSize
    }
    return @{ Duration = $duration; Size = $size }
}

function Install-Clip {
    param([string]$Source, [string]$Name)
    if (-not $Source) {
        $existing = Join-Path $videoDir $Name
        $info = Get-Mp4Info -Path $existing
        Write-Output ("  keep    {0}  {1} MB  {2}s  {3}" -f $Name, [Math]::Round((Get-Item $existing).Length / 1MB, 1), $info.Duration, $info.Size)
        return
    }
    if (-not (Test-Path $Source)) { throw "missing source: $Source" }
    $info = Get-Mp4Info -Path $Source
    $spec = $targets[$Name]
    $delta = [Math]::Abs($info.Duration - $spec.Seconds)
    if (-not $Force -and $delta -gt $spec.Tolerance) {
        throw ("{0} is {1}s, which is not the {2}s clip - wrong file? (pass -Force to override)" -f $Source, $info.Duration, $spec.Seconds)
    }
    Copy-Item -LiteralPath $Source -Destination (Join-Path $videoDir $Name) -Force
    $mb = [Math]::Round((Get-Item $Source).Length / 1MB, 1)
    $kbps = [Math]::Round(((Get-Item $Source).Length * 8 / 1000) / $info.Duration)
    Write-Output ("  swapped {0}  {1} MB  {2}s  {3}  ~{4} kbps" -f $Name, $mb, $info.Duration, $info.Size, $kbps)
}

Write-Output "=== swapping cut-scenes ==="
Install-Clip -Source $Night -Name "night-of-dragons.mp4"
Install-Clip -Source $Holding -Name "holding-hands.mp4"
Write-Output ""
Write-Output "next: pnpm build -> pnpm pack:win -> pnpm pack:installer, then rebuild the APK."
