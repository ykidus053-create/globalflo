$path = [Environment]::GetEnvironmentVariable('Path','User')
Set-ItemProperty -Path 'HKCU:\Environment' -Name Path -Value $path -Type ExpandString -Force
