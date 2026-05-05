import React from 'react';
import {Composition} from 'remotion';
import {ApdaProposal} from './ApdaProposal.jsx';
import {AnnexFiveVideo} from './AnnexFiveVideo.jsx';
import {annexFiveVideos} from './content/annexFiveVideos.js';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="ApdaProposal"
        component={ApdaProposal}
        durationInFrames={1560}
        fps={30}
        width={1920}
        height={1080}
      />
      {annexFiveVideos.map((video) => (
        <Composition
          key={video.id}
          id={video.id}
          component={AnnexFiveVideo}
          durationInFrames={1500}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{video}}
        />
      ))}
    </>
  );
};
