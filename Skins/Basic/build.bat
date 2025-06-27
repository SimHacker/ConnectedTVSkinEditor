set SKIN=Basic

set APP=..\..\ConnectedTV.prc
set DEST=..\..\prc
set PDB=pdb
set PILRCEXE=..\..\bin\pilrc.exe
set PILRC=%PILRCEXE% -I ..\..\Rsc -q -ro 
set PAREXE=..\..\bin\par.exe
set PAR=%PAREXE% a

%PILRC% Skin.rcp %PDB%\Skin.pdb
%PILRC% SkinBitmapsMinimal.rcp %PDB%\SkinBitmapsMinimal.pdb
%PILRC% SkinBitmapsMono.rcp %PDB%\SkinBitmapsMono.pdb
%PILRC% SkinBitmapsGray.rcp %PDB%\SkinBitmapsGray.pdb
%PILRC% SkinBitmapsColor.rcp %PDB%\SkinBitmapsColor.pdb
%PILRC% SkinBitmapsAll.rcp %PDB%\SkinBitmapsAll.pdb

set TARGET=ConnectedTVLite.prc
copy %APP% %DEST%\%TARGET%
%PAR% %DEST%\%TARGET% %PDB%\Skin.pdb %PDB%\SkinBitmapsMinimal.pdb

set TARGET=ConnectedTV.prc
copy %APP% %DEST%\%TARGET%
%PAR% %DEST%\%TARGET% %PDB%\Skin.pdb %PDB%\SkinBitmapsAll.pdb
