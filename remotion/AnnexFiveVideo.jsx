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
  ink: '#172026',
  muted: '#53636e',
  paper: '#f7faf9',
  border: '#d5e0e4',
  cyan: '#0b83a5',
  mint: '#1f8a70',
  amber: '#b8641c',
  red: '#b53333',
  navy: '#22313a',
};

const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
};

const fade = (frame, start, end) =>
  interpolate(frame, [start, end], [0, 1], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

const enter = (frame, delay = 0, distance = 32) => {
  const opacity = fade(frame, delay, delay + 22);
  const y = interpolate(frame, [delay, delay + 28], [distance, 0], {
    ...clamp,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return {opacity, transform: `translateY(${y}px)`};
};

const Shell = ({children, accent}) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 1500], [0, -230], clamp);

  return (
    <AbsoluteFill
      style={{
        background:
          'linear-gradient(135deg, #edf8fa 0%, #f7faf9 45%, #fff4e7 100%)',
        color: colors.ink,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(23,32,38,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(23,32,38,0.07) 1px, transparent 1px)',
          backgroundSize: '70px 70px',
          transform: `translateX(${drift}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: '0 0 auto',
          height: 360,
          background: `linear-gradient(180deg, ${accent}33, ${accent}00)`,
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

const Stage = ({children, from, duration}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [from + duration - 34, from + duration], [1, 0], clamp);

  return (
    <Sequence from={from} durationInFrames={duration}>
      <AbsoluteFill style={{padding: 76, opacity}}>{children}</AbsoluteFill>
    </Sequence>
  );
};

const Kicker = ({children, accent}) => (
  <div
    style={{
      alignSelf: 'flex-start',
      border: `2px solid ${accent}`,
      borderRadius: 999,
      color: accent,
      fontSize: 24,
      fontWeight: 760,
      letterSpacing: 1.1,
      padding: '10px 22px',
      textTransform: 'uppercase',
    }}
  >
    {children}
  </div>
);

const Header = ({video, compact = false}) => (
  <div style={{display: 'flex', justifyContent: 'space-between', gap: 36}}>
    <Kicker accent={video.accent}>{video.section}</Kicker>
    <div
      style={{
        color: colors.muted,
        fontSize: compact ? 22 : 24,
        fontWeight: 700,
        letterSpacing: 1,
        maxWidth: 820,
        textAlign: 'right',
        textTransform: 'uppercase',
      }}
    >
      {video.eyebrow}
    </div>
  </div>
);

const Title = ({children, size = 82, width = 1220}) => (
  <h1
    style={{
      fontSize: size,
      fontWeight: 820,
      letterSpacing: 0,
      lineHeight: 1.02,
      margin: '30px 0 0',
      maxWidth: width,
    }}
  >
    {children}
  </h1>
);

const Lead = ({children, width = 1040}) => (
  <p
    style={{
      color: colors.muted,
      fontSize: 33,
      lineHeight: 1.35,
      margin: '28px 0 0',
      maxWidth: width,
    }}
  >
    {children}
  </p>
);

const CardGrid = ({items, accent}) => {
  const frame = useCurrentFrame();
  const columns = items.length === 3 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)';

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: columns,
        gap: 26,
        marginTop: 78,
      }}
    >
      {items.map((item, index) => (
        <div
          key={item}
          style={{
            ...enter(frame, index * 24, 28),
            background: 'rgba(255,255,255,0.9)',
            border: `2px solid ${index % 2 === 0 ? accent : colors.border}`,
            borderRadius: 8,
            boxShadow: '0 24px 65px rgba(23,32,38,0.12)',
            fontSize: items.length > 3 ? 28 : 30,
            fontWeight: 720,
            lineHeight: 1.18,
            minHeight: items.length > 3 ? 156 : 190,
            padding: 28,
          }}
        >
          <div style={{color: accent, fontSize: 25, fontWeight: 850, marginBottom: 12}}>
            {String(index + 1).padStart(2, '0')}
          </div>
          {item}
        </div>
      ))}
    </div>
  );
};

const Flow = ({title, items, accent}) => {
  const frame = useCurrentFrame();

  return (
    <div style={{marginTop: 78}}>
      <div
        style={{
          color: colors.muted,
          fontSize: 25,
          fontWeight: 760,
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </div>
      <div style={{display: 'flex', gap: 14, marginTop: 22}}>
        {items.map((item, index) => {
          const progress = fade(frame, 18 + index * 14, 38 + index * 14);
          return (
            <React.Fragment key={item}>
              <div
                style={{
                  opacity: progress,
                  background: '#fff',
                  border: `2px solid ${accent}`,
                  borderRadius: 999,
                  color: colors.ink,
                  fontSize: 25,
                  fontWeight: 780,
                  padding: '17px 22px',
                  whiteSpace: 'nowrap',
                }}
              >
                {item}
              </div>
              {index < items.length - 1 ? (
                <div
                  style={{
                    alignSelf: 'center',
                    background: colors.border,
                    height: 3,
                    opacity: progress,
                    width: 28,
                  }}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

const DocumentVisual = ({accent}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const spread = spring({frame, fps, config: {damping: 18}});
  const docs = [
    ['DOCX', 'campos livres', '#0b83a5'],
    ['XLSX', 'cores e celulas', '#1f8a70'],
    ['PDF', 'relatorios AEE', '#b8641c'],
  ];

  return (
    <div style={{position: 'relative', width: 610, height: 430}}>
      {docs.map(([label, detail, color], index) => {
        const x = interpolate(spread, [0, 1], [0, index * 58]);
        const y = interpolate(spread, [0, 1], [0, index * 46]);
        return (
          <div
            key={label}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: 450,
              height: 222,
              background: '#fff',
              border: `3px solid ${color}`,
              borderRadius: 8,
              boxShadow: '0 28px 80px rgba(23,32,38,0.14)',
              padding: 28,
              transform: `rotate(${(index - 1) * 4}deg)`,
            }}
          >
            <div style={{color, fontSize: 30, fontWeight: 850}}>{label}</div>
            <div style={{color: colors.muted, fontSize: 24, marginTop: 18}}>{detail}</div>
            <div style={{background: `${accent}33`, borderRadius: 8, height: 16, marginTop: 38, width: 286}} />
            <div style={{background: '#e7d9c8', borderRadius: 8, height: 16, marginTop: 16, width: 200}} />
          </div>
        );
      })}
    </div>
  );
};

const MetricBoard = ({video}) => {
  const frame = useCurrentFrame();
  const metrics = video.cards.slice(0, 4);

  return (
    <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 22, marginTop: 88}}>
      {metrics.map((metric, index) => (
        <div
          key={metric}
          style={{
            ...enter(frame, index * 22, 24),
            background: '#fff',
            borderLeft: `9px solid ${video.accent}`,
            borderRadius: 8,
            boxShadow: '0 20px 58px rgba(23,32,38,0.1)',
            minHeight: 230,
            padding: '30px 28px',
          }}
        >
          <div style={{color: video.accent, fontSize: 58, fontWeight: 850, lineHeight: 1}}>
            {String(index + 1).padStart(2, '0')}
          </div>
          <div style={{fontSize: 25, fontWeight: 730, lineHeight: 1.18, marginTop: 20}}>
            {metric}
          </div>
        </div>
      ))}
    </div>
  );
};

export const AnnexFiveVideo = ({video}) => {
  const frame = useCurrentFrame();

  return (
    <Shell accent={video.accent}>
      <Stage from={0} duration={360}>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 650px', gap: 78, height: '100%'}}>
          <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center'}}>
            <div style={enter(frame, 0)}>
              <Kicker accent={video.accent}>{video.section}</Kicker>
              <Title>{video.title}</Title>
              <Lead>{video.lead}</Lead>
            </div>
          </div>
          <div style={{alignItems: 'center', display: 'flex', justifyContent: 'center'}}>
            <DocumentVisual accent={video.accent} />
          </div>
        </div>
      </Stage>

      <Stage from={360} duration={570}>
        <Header video={video} />
        {video.id === 'Annex5MetricsBiasTests' || video.id === 'Annex5DataRightsTransparency' ? (
          <MetricBoard video={video} />
        ) : (
          <CardGrid items={video.cards} accent={video.accent} />
        )}
      </Stage>

      <Stage from={930} duration={420}>
        <Header video={video} compact />
        <Flow title={video.flowTitle} items={video.flow} accent={video.accent} />
        <div
          style={{
            ...enter(frame, 82, 22),
            background: colors.navy,
            borderRadius: 8,
            boxShadow: '0 30px 80px rgba(23,32,38,0.18)',
            color: '#fff',
            fontSize: 40,
            fontWeight: 780,
            lineHeight: 1.22,
            marginTop: 92,
            maxWidth: 1320,
            padding: '38px 44px',
          }}
        >
          {video.closing}
        </div>
      </Stage>

      <Stage from={1350} duration={150}>
        <div style={{display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center'}}>
          <Kicker accent={video.accent}>Anexo IV</Kicker>
          <Title size={70} width={1480}>{video.eyebrow}</Title>
          <Lead width={1180}>{video.summary}</Lead>
        </div>
      </Stage>
    </Shell>
  );
};
