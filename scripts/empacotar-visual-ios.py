"""Atualiza os recursos web do IPA nativo existente, sem compilar/assinar/publicar."""
from pathlib import Path
import hashlib
import json
import plistlib
import zipfile

root = Path(__file__).resolve().parent.parent
base = root / 'Forza-Run-garmin-todas-semanas-2026-10-14.ipa'
destino = root / 'Forza-Run-visual-2026-10-15-sem-assinatura.ipa'
www = root / 'www'
prefixo = 'Payload/App.app/public/'
sha = lambda data: hashlib.sha256(data).hexdigest()

if destino.exists():
    raise SystemExit('O IPA de destino já existe; não será sobrescrito.')
if (www / 'index.html').read_bytes() != (root / 'treino-app.html').read_bytes():
    raise SystemExit('Build desatualizado: execute npm run build.')

arquivos = {p.relative_to(www).as_posix(): p for p in www.rglob('*') if p.is_file()}
with zipfile.ZipFile(base) as anterior:
    app_info = plistlib.loads(anterior.read('Payload/App.app/Info.plist'))
    if app_info.get('CFBundleIdentifier') != 'com.meuritmo.app':
        raise SystemExit('Identidade inesperada no IPA de origem.')
    if any('/_CodeSignature/' in n or n.endswith('/embedded.mobileprovision') for n in anterior.namelist()):
        raise SystemExit('O pacote de origem contém assinatura/perfil; requer fluxo próprio de reassinatura.')
    # Os arquivos bootstrap que o Capacitor copia para public não estão em www.
    bootstrap = {'cordova.js', 'cordova_plugins.js', 'capacitor.js', 'capacitor_plugins.js'}
    copiados = set()
    with zipfile.ZipFile(destino, 'x', compression=zipfile.ZIP_DEFLATED) as novo:
        for entrada in anterior.infolist():
            nome = entrada.filename
            if nome.startswith(prefixo) and not entrada.is_dir():
                rel = nome[len(prefixo):]
                if rel in arquivos:
                    novo.writestr(entrada, arquivos[rel].read_bytes())
                    copiados.add(rel)
                elif rel in bootstrap or rel.startswith('plugins/'):
                    novo.writestr(entrada, anterior.read(nome))
            else:
                novo.writestr(entrada, anterior.read(nome))
        for rel in sorted(arquivos.keys() - copiados):
            entrada = zipfile.ZipInfo(prefixo + rel)
            entrada.create_system = 3
            entrada.external_attr = 0o100644 << 16
            entrada.compress_type = zipfile.ZIP_DEFLATED
            novo.writestr(entrada, arquivos[rel].read_bytes())

with zipfile.ZipFile(base) as anterior, zipfile.ZipFile(destino) as novo:
    if novo.testzip() is not None:
        raise RuntimeError('Falha de integridade no ZIP.')
    preservados = [e.filename for e in anterior.infolist() if not e.is_dir() and not e.filename.startswith(prefixo)]
    for nome in preservados:
        if anterior.read(nome) != novo.read(nome):
            raise RuntimeError('Arquivo nativo alterado: ' + nome)
    for rel, arquivo in arquivos.items():
        if novo.read(prefixo + rel) != arquivo.read_bytes():
            raise RuntimeError('Recurso web divergente: ' + rel)
    resultado = {
        'arquivo': str(destino), 'base': str(base), 'assinado': False,
        'metodo': 'Recursos web atuais sobre o binário nativo existente; sem recompilação nativa',
        'bundleId': app_info['CFBundleIdentifier'],
        'recursosWebVerificados': len(arquivos),
        'arquivosNativosPreservados': len(preservados),
        'executavelNativoSha256': sha(novo.read('Payload/App.app/App')),
        'htmlSha256': sha(novo.read(prefixo + 'index.html')),
        'ipaSha256': sha(destino.read_bytes()),
        'tamanhoBytes': destino.stat().st_size,
    }
relatorio = root / 'artifacts' / 'visual-pacote-2026-10-15' / 'ipa-local.json'
relatorio.parent.mkdir(parents=True, exist_ok=True)
relatorio.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(resultado, ensure_ascii=False, indent=2))
