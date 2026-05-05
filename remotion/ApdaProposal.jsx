import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const colors = {
  ink: '#152027',
  muted: '#53636e',
  paper: '#f7faf9',
  line: '#cfdde1',
  cyan: '#0b83a5',
  mint: '#1f8a70',
  amber: '#b8641c',
  red: '#b53333',
  navy: '#22313a',
};

const scenes = [
  {from: 0, duration: 210},
  {from: 210, duration: 270},
  {from: 480, duration: 330},
  {from: 810, duration: 270},
  {from: 1080, duration: 300},
  {from: 1380, duration: 180},
];

const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
};

const fade = (frame, start, end) =>
  interpolate(frame, [start, end], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

const enter = (frame, delay = 0, distance = 36) => {
  const opacity = fade(frame, delay, delay + 24);
  const y = interpolate(frame, [delay, delay + 30], [distance, 0], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return {opacity, transform: `translateY(${y}px)`};
};

const shell = {
  width: '100%',
  height: '100%',
  padding: 76,
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: colors.ink,
};

const Background = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 1560], [0, -260], clamp);

  return (
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(135deg, #eef8fa 0%, #f7faf9 42%, #fff4e6 100%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(21,32,39,0.075) 1px, transparent 1px), linear-gradient(90deg, rgba(21,32,39,0.075) 1px, transparent 1px)',
          backgroundSize: '68px 68px',
          transform: `translateX(${drift}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '0 0 auto',
          height: 360,
          background:
            'linear-gradient(180deg, rgba(11,131,165,0.22), rgba(11,131,165,0))',
        }}
      />
    </AbsoluteFill>
  );
};

const Kicker = ({children, tone = colors.cyan}) => (
  <div
    style={{
      alignSelf: 'flex-start',
      border: `2px solid ${tone}`,
      borderRadius: 999,
      color: tone,
      fontSize: 25,
      fontWeight: 700,
      letterSpacing: 1.2,
      padding: '10px 22px',
      textTransform: 'uppercase',
    }}
  >
    {children}
  </div>
);

const Title = ({children, maxWidth = 1100}) => (
  <h1
    style={{
      fontSize: 88,
      fontWeight: 780,
      lineHeight: 0.98,
      letterSpacing: 0,
      margin: '30px 0 0',
      maxWidth,
    }}
  >
    {children}
  </h1>
);

const Lead = ({children, maxWidth = 960}) => (
  <p
    style={{
      color: colors.muted,
      fontSize: 34,
      lineHeight: 1.33,
      margin: '28px 0 0',
      maxWidth,
    }}
  >
    {children}
  </p>
);

const MiniCard = ({children, color = colors.cyan, delay = 0}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...enter(frame, delay, 28),
        background: 'rgba(255,255,255,0.88)',
        border: `2px solid ${color}`,
        borderRadius: 8,
        boxShadow: '0 24px 60px rgba(21,32,39,0.12)',
        color: colors.ink,
        fontSize: 29,
        fontWeight: 680,
        lineHeight: 1.18,
        padding: 26,
      }}
    >
      {children}
    </div>
  );
};

const Header = ({section, children}) => (
  <div style={{display: 'flex', justifyContent: 'space-between', gap: 36}}>
    <Kicker>{section}</Kicker>
    <div
      style={{
        color: colors.muted,
        fontSize: 24,
        fontWeight: 650,
        letterSpacing: 1,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </div>
  </div>
);

const Scene = ({index, children}) => {
  const frame = useCurrentFrame();
  const {from, duration} = scenes[index];
  const exit = interpolate(frame, [from + duration - 30, from + duration], [1, 0], clamp);

  return (
    <Sequence from={from} durationInFrames={duration}>
      <AbsoluteFill style={{...shell, opacity: exit}}>{children}</AbsoluteFill>
    </Sequence>
  );
};

const DocumentStack = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const spread = spring({frame, fps, config: {damping: 18}});
  const cards = [
    ['DOCX', 'relatorios narrativos', colors.cyan],
    ['XLSX', 'planilhas municipais', colors.mint],
    ['PDF', 'planos e diarios AEE', colors.amber],
  ];

  return (
    <div style={{position: 'relative', width: 560, height: 430}}>
      {cards.map(([label, text, color], i) => {
        const x = interpolate(spread, [0, 1], [0, i * 54]);
        const y = interpolate(spread, [0, 1], [0, i * 44]);
        return (
          <div
            key={label}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 430,
              height: 220,
              background: '#fff',
              border: `3px solid ${color}`,
              borderRadius: 8,
              boxShadow: '0 28px 80px rgba(21,32,39,0.14)',
              padding: 28,
              transform: `rotate(${(i - 1) * 4}deg)`,
            }}
          >
            <div style={{fontSize: 28, fontWeight: 800, color}}>{label}</div>
            <div style={{fontSize: 24, color: colors.muted, marginTop: 18}}>{text}</div>
            <div
              style={{
                height: 16,
                width: 270,
                borderRadius: 8,
                background: '#d9e7ea',
                marginTop: 38,
              }}
            />
            <div
              style={{
                height: 16,
                width: 190,
                borderRadius: 8,
                background: '#e7d9c8',
                marginTop: 16,
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

const JsonPanel = () => {
  const frame = useCurrentFrame();
  const progress = fade(frame, 42, 82);

  return (
    <div
      style={{
        background: colors.navy,
        borderRadius: 8,
        boxShadow: '0 34px 90px rgba(21,32,39,0.22)',
        color: '#d8f3f0',
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
        fontSize: 24,
        lineHeight: 1.45,
        opacity: progress,
        padding: 34,
        width: 590,
      }}
    >
      <div style={{color: '#7dd3fc'}}>{'{'}</div>
      <div>&nbsp;&nbsp;"artefato": "plano_aee",</div>
      <div>&nbsp;&nbsp;"anonimizacao": true,</div>
      <div>&nbsp;&nbsp;"schema": "APDA",</div>
      <div>&nbsp;&nbsp;"validacao_humana": "necessaria"</div>
      <div style={{color: '#7dd3fc'}}>{'}'}</div>
    </div>
  );
};

const Pipeline = () => {
  const frame = useCurrentFrame();
  const steps = [
    ['1', 'Ingestao', colors.cyan],
    ['2', 'Extracao', colors.cyan],
    ['3', 'Anonimizacao', colors.red],
    ['4', 'Estrutura APDA', colors.mint],
    ['5', 'Validacao', colors.amber],
    ['6', 'Auditoria', colors.navy],
  ];

  return (
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 18, marginTop: 88}}>
      {steps.map(([num, label, color], i) => {
        const active = fade(frame, i * 22, i * 22 + 18);
        return (
          <div key={label} style={{opacity: active}}>
            <div
              style={{
                alignItems: 'center',
                background: '#fff',
                border: `3px solid ${color}`,
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                height: 210,
                justifyContent: 'center',
                padding: 20,
              }}
            >
              <div
                style={{
                  alignItems: 'center',
                  background: color,
                  borderRadius: 999,
                  color: '#fff',
                  display: 'flex',
                  fontSize: 34,
                  fontWeight: 820,
                  height: 70,
                  justifyContent: 'center',
                  width: 70,
                }}
              >
                {num}
              </div>
              <div style={{fontSize: 28, fontWeight: 760, marginTop: 22, textAlign: 'center'}}>
                {label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const Metric = ({value, label, color, delay}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        ...enter(frame, delay, 22),
        background: '#fff',
        borderLeft: `9px solid ${color}`,
        borderRadius: 8,
        boxShadow: '0 20px 60px rgba(21,32,39,0.1)',
        padding: '30px 34px',
      }}
    >
      <div style={{color, fontSize: 62, fontWeight: 820, lineHeight: 1}}>{value}</div>
      <div style={{color: colors.muted, fontSize: 28, fontWeight: 650, marginTop: 12}}>
        {label}
      </div>
    </div>
  );
};

const ClosingMark = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 36], [0.92, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        gap: 34,
        marginTop: 62,
        transform: `scale(${scale})`,
        transformOrigin: 'left center',
      }}
    >
      <div
        style={{
          alignItems: 'center',
          background: colors.ink,
          borderRadius: 8,
          color: '#fff',
          display: 'flex',
          fontSize: 54,
          fontWeight: 860,
          height: 108,
          justifyContent: 'center',
          width: 108,
        }}
      >
        A
      </div>
      <div style={{fontSize: 33, color: colors.muted, fontWeight: 650}}>
        Open source. Local. Auditavel. Pensado para redes municipais.
      </div>
    </div>
  );
};

export const ApdaProposal = () => {
  return (
    <AbsoluteFill>
      <Background />

      <Scene index={0}>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 640px', gap: 72, height: '100%'}}>
          <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
            <div style={enter(useCurrentFrame(), 0)}>
              <Kicker>Sandbox Regulatorio MEC</Kicker>
              <Title>APDA Framework</Title>
              <Lead>
                Artefatos Pedagogicos Digitais Abertos para transformar registros pedagógicos em
                dados estruturados, anonimizados e auditáveis.
              </Lead>
            </div>
          </div>
          <div style={{alignItems: 'center', display: 'flex', justifyContent: 'center'}}>
            <DocumentStack />
          </div>
        </div>
      </Scene>

      <Scene index={1}>
        <Header section="Problema">Registros importantes ficam fora da infraestrutura de dados</Header>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 28, marginTop: 96}}>
          <MiniCard color={colors.amber} delay={6}>
            Planilhas, PDFs e relatos variam entre municípios.
          </MiniCard>
          <MiniCard color={colors.red} delay={34}>
            Dados sensíveis exigem anonimização antes de qualquer IA.
          </MiniCard>
          <MiniCard color={colors.cyan} delay={62}>
            Sem estrutura, estudantes e necessidades podem não aparecer nas políticas públicas.
          </MiniCard>
        </div>
        <Lead maxWidth={1240}>
          O APDA atua como uma camada de tradução entre o trabalho cotidiano do AEE e a gestão
          educacional interoperável.
        </Lead>
      </Scene>

      <Scene index={2}>
        <Header section="Pipeline">Do documento heterogêneo ao JSON APDA validável</Header>
        <Pipeline />
        <div style={{display: 'grid', gridTemplateColumns: '1fr 590px', gap: 46, marginTop: 82}}>
          <Lead maxWidth={980}>
            A arquitetura preserva contexto estrutural, separa unidades semânticas e só gera
            artefatos depois da anonimização.
          </Lead>
          <JsonPanel />
        </div>
      </Scene>

      <Scene index={3}>
        <Header section="Salvaguardas">IA como apoio, não como decisão automática</Header>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginTop: 104}}>
          <Metric value="01" label="Anonimização multicamadas antes do LLM" color={colors.red} delay={8} />
          <Metric value="02" label="Validação por JSON Schema APDA" color={colors.cyan} delay={34} />
          <Metric value="03" label="Logs e trilha de auditoria por documento" color={colors.amber} delay={60} />
          <Metric value="04" label="Revisão humana obrigatória" color={colors.mint} delay={86} />
        </div>
      </Scene>

      <Scene index={4}>
        <Header section="Valor publico">Evidência técnica para inovação responsável</Header>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 94}}>
          <MiniCard color={colors.cyan} delay={4}>
            Prepara redes municipais para dados educacionais interoperáveis.
          </MiniCard>
          <MiniCard color={colors.mint} delay={32}>
            Ajuda a construir um dataset de AEE anonimizado e validado.
          </MiniCard>
          <MiniCard color={colors.amber} delay={60}>
            Produz evidências para diálogo regulatório com o MEC.
          </MiniCard>
          <MiniCard color={colors.navy} delay={88}>
            Roda localmente, com modelos abertos e sem lock-in.
          </MiniCard>
        </div>
      </Scene>

      <Scene index={5}>
        <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%'}}>
          <Kicker tone={colors.mint}>Proposta APDA</Kicker>
          <Title maxWidth={1360}>Dados pedagógicos mais seguros, visíveis e úteis para a educação pública.</Title>
          <ClosingMark />
        </div>
      </Scene>
    </AbsoluteFill>
  );
};
