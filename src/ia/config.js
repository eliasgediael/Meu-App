// Personalização da musculação pelo Gemini: configuração do lado do app.
// A IA fica DESLIGADA por padrão (ativa:false). Com ela desligada, nada muda: o plano é sempre o do Motor V2.
// Os números marcados como provisórios ainda precisam de teste e aprovação antes de valer como regra.
/* eslint-disable */
const IA_CONFIG = {
  ativa: false,
  publicacaoAutorizada: false,
  servidorUrl: '',
  versaoContrato: '1',
  timeoutMs: 25000,
  maxBytesResposta: 24000,
  // F2 (provisório): faixa de repetições aceita em torno da meta que o motor usaria para o mesmo papel/nível/foco.
  repsAbaixo: 4, repsAcima: 6, repsMin: 3, repsMax: 20, repsMinIniciante: 8,
  rpeMin: 5,
  seriesMin: 2,
  descansoMinSeg: 45, descansoMaxSeg: 180, descansoMinForcaBaseSeg: 90,
  // F6a (bloqueante): o total de séries da semana nunca passa do total do plano do motor (a IA redistribui, não aumenta).
  totalSeriesNaoPassaDoMotor: true,
  // F6b (provisório, DESLIGADO): faixas de séries semanais por grupo muscular. Ligado, só gera aviso — nunca bloqueia.
  volumeFaixas: {
    ativa: false,
    grupos: ['Peito', 'Costas', 'Pernas', 'Ombro'],
    porNivel: { iniciante: [4, 10], intermediario: [6, 14], avancado: [8, 20] },
    manutencao: [3, 8],
  },
};

export { IA_CONFIG };
