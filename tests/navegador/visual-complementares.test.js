const fs = require('fs');
const path = require('path');
const { abrirApp, ok: verificar } = require('../harness/navegador');
let verificacoes=0,falhas=0;
const ok=(cond,msg)=>{verificacoes++;if(!cond)falhas++;verificar(cond,msg);};

(async () => {
  const app = await abrirApp({diagnostico:process.argv.includes('--diagnostico')});
  if (!app || app.indisponivel) throw Error(app?.indisponivel || 'Navegador indisponível');
  const { page } = app;
  const dir = path.resolve('artifacts/visual-pacote-2026-10-15/complementares');
  fs.mkdirSync(dir, { recursive: true });
  const capturas = [];
  async function captura(name, width) {
    if(await page.$('#appToast')) await page.waitForSelector('#appToast',{hidden:true,timeout:5000});
    await new Promise(resolve=>setTimeout(resolve,250));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    ok(!overflow, `${name}: sem transbordamento em ${width}px`);
    await page.screenshot({ path: path.join(dir, `${name}-${width}.png`), fullPage: true });
    capturas.push({ name, width, overflow });
  }
  try {
    await page.evaluate(() => {
      window.__resetOriginal = auth.sendPasswordResetEmail;
      window.__resetCalls = [];
      auth.sendPasswordResetEmail = email => {
        window.__resetCalls.push(email);
        return new Promise((resolve, reject) => { window.__resetResolve=resolve; window.__resetReject=reject; });
      };
      window.__bridgeOriginal = window.NativeBridge;
      window.__cloudOriginal = {...cloudStatus};
      window.__genOriginal = gerarPrimeiroPlanoV2;
      window.__relogioApiOriginal = relogioApi;
      window.__relogioEstadoOriginal = _relogioEstado;
    });
    for (const width of [320, 390, 430]) {
      await page.setViewport({ width, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      await page.evaluate(() => {
        state.gpsRun=null; state.authUser=null; state.authScreen=null; state.authBusy=null; state.authError=null;
        state.tab='conta'; state.subOrigin='perfil'; render();
        document.getElementById('inAuthEmail').value='teste@example.com';
        document.getElementById('btnAuthEsqueciSenha').click();
      });
      ok(await page.$eval('#inAuthEmail', el=>el.value)==='teste@example.com', `recuperação conserva e-mail em ${width}`);
      await captura('recuperar-senha', width);
      const chamadas = await page.evaluate(()=>window.__resetCalls.length);
      await page.click('#btnAuthResetSenha');
      ok(await page.evaluate(()=>state.authScreen==='recuperar' && !!document.querySelector('#btnAuthResetSenha[disabled]')), `sem confirmação antecipada em ${width}`);
      await page.evaluate(()=>window.__resetReject({code:'auth/network-request-failed',message:'Sem rede'}));
      await page.waitForFunction(()=>!state.authBusy);
      ok(await page.evaluate(()=>state.authScreen==='recuperar' && !!document.querySelector('[role="alert"]') && document.getElementById('inAuthEmail').value==='teste@example.com'), `falha preserva formulário e permite tentar novamente em ${width}`);
      await captura('recuperar-senha-erro', width);
      await page.click('#btnAuthResetSenha');
      await page.evaluate(()=>window.__resetResolve());
      await page.waitForSelector('#btnAuthVoltarEntrar');
      ok(await page.evaluate(()=>state.authScreen==='senha-enviada' && document.body.textContent.includes('Se houver uma conta')), `confirmação neutra após resposta real do contrato em ${width}`);
      ok(await page.evaluate(()=>window.__resetCalls.length)===chamadas+2, `uma chamada por tentativa em ${width}`);
      await captura('senha-enviada', width);
      await page.click('#btnAuthVoltarEntrar');
      ok(await page.$('#btnAuthEntrar')!==null, `retorno ao login em ${width}`);

      await page.evaluate(()=>{
        state.tab='meusTreinos'; state.weekOffset=0;
        const day=DAY_ABBR.find(d=>treinoEntryForDay(d));
        state.gpsRun=gpsNewRunState(day,treinoEntryForDay(day));
        state.gpsRun.status='denied'; state.gpsRun.denyReason='negada';
        window.__gpsOriginalSteps=JSON.stringify(state.gpsRun.steps); render();
      });
      await captura('gps-negado', width);
      await page.click('#gpsBtnLocationHelp');
      ok(await page.evaluate(()=>state.gpsRun.status==='denied' && document.body.textContent.includes('navegador')), `orientação web preserva estado negado em ${width}`);
      await captura('gps-orientacao-web', width);
      await page.evaluate(()=>{window.NativeBridge={isNative:()=>true};render();});
      ok(await page.evaluate(()=>document.body.textContent.includes('Ajustes do iPhone')), `orientação nativa usa instruções do iPhone em ${width}`);
      await captura('gps-orientacao', width);
      await page.evaluate(()=>{window.NativeBridge=window.__bridgeOriginal;document.getElementById('gpsLocationHelpBack').click();});
      ok(await page.$('#gpsBtnRetry')!==null, `voltar mantém tentativa de GPS disponível em ${width}`);
      await page.click('#gpsBtnLocationHelp');
      await page.click('#gpsLocationHelpPrepare');
      ok(await page.evaluate(()=>state.gpsRun.status==='intro' && JSON.stringify(state.gpsRun.steps)===window.__gpsOriginalSteps && !state.gpsRun.startedAt), `preparação preserva prescrição sem iniciar GPS em ${width}`);
      await page.evaluate(()=>{state.gpsRun.status='denied';render();});
      await page.click('#gpsBtnDeniedTreadmill');
      ok(await page.evaluate(()=>state.gpsRun.mode==='esteira' && state.gpsRun.status==='intro' && JSON.stringify(state.gpsRun.steps)===window.__gpsOriginalSteps && !state.gpsRun.startedAt), `esteira reutiliza preparação e etapas reais em ${width}`);

      await page.evaluate(()=>{state.gpsRun=null;state.tab='perfil';render();document.querySelector('[data-perfilgo="recursos"]').click();});
      await captura('recursos', width);
      ok(await page.$$eval('[data-recursogo]',els=>els.length)===3, `recursos expõe três destinos reais em ${width}`);
      await page.click('[data-recursogo="biblioteca"]');
      ok(await page.evaluate(()=>state.tab==='biblioteca'), `abre biblioteca existente em ${width}`);
      await page.click('#mrtSubBack');
      ok(await page.evaluate(()=>state.tab==='recursos'), `voltar da biblioteca conserva origem em ${width}`);
      await page.click('[data-recursogo="personal"]');
      ok(await page.evaluate(()=>state.tab==='personal' && document.body.textContent.includes('Entre na sua conta')), `personal mantém acesso sem conta honesto em ${width}`);
      await page.click('#mrtSubBack');
      await page.click('#mrtSubBack');
      ok(await page.evaluate(()=>state.tab==='perfil'), `voltar retorna ao Perfil em ${width}`);
      await page.evaluate(()=>{state.tab='progresso';state.progHistorico=false;state.progDetalhe=null;state.progAnalises=false;state.progModo='mes';render();document.querySelector('[data-proganalises]').click();});
      await captura('analises', width);
      for (const detalhe of ['corrida','musc','medidas']) {
        await page.click(`[data-progdet="${detalhe}"]`);
        ok(await page.evaluate(k=>state.progDetalhe===k,detalhe), `análises abre ${detalhe} existente em ${width}`);
        await page.click('[data-progdetvoltar]');
        ok(await page.$('[data-proganalisesvoltar]')!==null, `detalhe ${detalhe} retorna à lista em ${width}`);
      }
      await page.click('[data-proganalisesvoltar]');
      ok(await page.evaluate(()=>!state.progAnalises && state.progModo==='mes'), `análises preserva período ao voltar em ${width}`);
      await page.evaluate(()=>{state.authUser=null;state.tab='sincronizacao';render();});
      await captura('sincronizacao-sem-conta',width);
      ok(await page.evaluate(()=>{const t=document.querySelector('.mrt-root').textContent;return t.includes('Sem conta conectada') && !t.includes('em dia');}),`sincronização sem conta não simula sucesso em ${width}`);
      await page.evaluate(()=>{state.authUser={uid:'fixture-sync',email:'teste@example.com'};cloudStatus.pendingWrites=2;cloudStatus.writeOk=true;cloudStatus.readOk=true;render();});
      await captura('sincronizacao',width);
      ok(await page.evaluate(()=>{const t=document.querySelector('.mrt-root').textContent;return t.includes('2 gravações pendentes') && !t.includes('Última gravação confirmada');}),`pendências prevalecem sobre sucesso anterior em ${width}`);
      await page.evaluate(()=>{cloudStatus.pendingWrites=0;cloudStatus.writeOk=false;render();});
      ok(await page.evaluate(()=>document.body.textContent.includes('Não foi possível concluir')),`sincronização mostra falha real em ${width}`);
      await page.evaluate(async()=>{
        state.authUser=null;
        qv2Abrir();
        state.qv2.R.obj='saude';
        state.qv2.resumo=[{texto:'Respostas preservadas'}];
        window.__respostasAntes=JSON.stringify(state.qv2.R);
        gerarPrimeiroPlanoV2=async()=>null;
        await qv2Gerar();
      });
      await captura('erro-geracao',width);
      ok(await page.evaluate(()=>document.body.textContent.includes('Não foi possível gerar') && JSON.stringify(state.qv2.R)===window.__respostasAntes),`falha de geração preserva respostas em ${width}`);
      await page.click('#qv2Prox2');
      ok(await page.evaluate(()=>state.qv2.fase==='entendi' && !state.qv2.erroGeracao && JSON.stringify(state.qv2.R)===window.__respostasAntes),`revisar respostas não abandona questionário em ${width}`);
      await page.evaluate(()=>{state.qv2=null;gerarPrimeiroPlanoV2=window.__genOriginal;Object.assign(cloudStatus,window.__cloudOriginal);render();});
      await page.evaluate(async()=>{
        state.tab='maisOpcoes';render();
        window.__perfilAntesImportar=(await window.storage.get('perfil'))?.value;
        window.__importPromise=importBackupFile(new File([JSON.stringify({perfil:JSON.stringify({nome:'Não deve ser gravado'}),workoutSessionsLog:JSON.stringify([{id:'exemplo-fixture'}])})],'<backup>.json',{type:'application/json'}));
      });
      await page.waitForSelector('#cfCancel');
      await captura('importar-previa',width);
      ok(await page.evaluate(()=>document.querySelector('.sheet').textContent.includes('<backup>.json') && !document.querySelector('.sheet backup')),`nome do backup é escapado na prévia em ${width}`);
      await page.click('#cfCancel');
      await page.evaluate(()=>window.__importPromise);
      ok(await page.evaluate(async()=>(await window.storage.get('perfil'))?.value===window.__perfilAntesImportar),`cancelar importação não altera dados em ${width}`);
      await page.evaluate(()=>{
        window.__forgetCalls=0;window.__forgetFail=false;window.__mockRelogios=[{nome:'Relógio de teste',status:'conectado'}];
        window.__historicoAntesGarmin=JSON.stringify([state.workoutSessionsLog,state.corridaProgress,state.atividadesLivres]);
        relogioApi=()=>({esquecer:async()=>{window.__forgetCalls++;if(!window.__forgetFail)window.__mockRelogios=[];return {relogios:[]};},estado:async()=>({relogios:window.__mockRelogios}),ouvir:()=>{}});
        _relogioEstado={relogios:window.__mockRelogios};state.tab='integracoes';render();
      });
      await page.click('#btnRelogioDesconectar');
      await captura('desconectar-garmin',width);
      await page.click('#cfCancel');
      ok(await page.evaluate(()=>window.__forgetCalls===0),`cancelar desconexão não chama ponte em ${width}`);
      await page.click('#btnRelogioDesconectar');await page.click('#cfOk');
      await page.waitForFunction(()=>_relogioEstado.relogios.length===0);
      ok(await page.evaluate(()=>window.__forgetCalls===1 && JSON.stringify([state.workoutSessionsLog,state.corridaProgress,state.atividadesLivres])===window.__historicoAntesGarmin),`desconexão confirmada preserva histórico em ${width}`);
      await page.evaluate(()=>{window.__forgetFail=true;window.__mockRelogios=[{nome:'Relógio de teste',status:'conectado'}];_relogioEstado={relogios:window.__mockRelogios};render();});
      await page.click('#btnRelogioDesconectar');await page.click('#cfOk');
      await page.waitForFunction(()=>document.querySelector('#appToast')?.textContent.includes('Não foi possível confirmar'));
      ok(await page.evaluate(()=>_relogioEstado.relogios.length===1),`falha de desconexão não vira sucesso em ${width}`);
      await page.evaluate(()=>{relogioApi=window.__relogioApiOriginal;_relogioEstado=window.__relogioEstadoOriginal;closeSheet();});
    }
    // Uma resposta atrasada não pode arrancar o usuário da aba em que está.
    await page.evaluate(()=>{state.tab='conta';state.authScreen='recuperar';state.authResetEmail='teste@example.com';render();document.getElementById('btnAuthResetSenha').click();state.tab='meusTreinos';state.authScreen=null;render();window.__resetResolve();});
    await page.waitForFunction(()=>!state.authBusy);
    ok(await page.evaluate(()=>state.tab==='meusTreinos' && state.authScreen===null), 'resposta tardia de recuperação não muda aba nem abre confirmação');
    ok(app.erros.length===0, 'sem erros de execução: '+app.erros.join(' | '));
    const fonteSha256=require('crypto').createHash('sha256').update(fs.readFileSync(path.resolve('treino-app.html'))).digest('hex');
    fs.writeFileSync(path.join(dir,'resultados.json'),JSON.stringify({capturas,verificacoes,falhas,fonteSha256,erros:app.erros,errosInicio:app.errosInicio},null,2));
  } finally {
    await page.evaluate(()=>{auth.sendPasswordResetEmail=window.__resetOriginal;window.NativeBridge=window.__bridgeOriginal;gerarPrimeiroPlanoV2=window.__genOriginal;relogioApi=window.__relogioApiOriginal;_relogioEstado=window.__relogioEstadoOriginal;Object.assign(cloudStatus,window.__cloudOriginal);});
    await app.fechar();
  }
})().catch(e=>{console.error('FAIL '+e.stack);process.exitCode=1;});
