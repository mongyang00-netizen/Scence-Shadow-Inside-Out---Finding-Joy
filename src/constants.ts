import { MovieSettings, Sentence } from './types';

export const MOVIE_SETTINGS: MovieSettings = {
  titleEn: 'Inside Out',
  titleKo: '인사이드아웃',
  releaseYear: 2015,
  director: 'Pete Docter',
  screenplay: 'Pete Docter, Meg LeFauve, Josh Cooley',
  production: 'Pixar Animation Studios',
  distribution: 'Walt Disney Studios Motion Pictures',
  sceneDescription: '슬픔이와 기쁨이의 대화',
  youtubeTitle: 'Seasonal Sadness | Inside Out | Official Clip',
  youtubeChannel: 'Pixar',
  youtubeUrl: 'https://youtu.be/JhAzwl6pWq0?si=f_tW32zzuRHANNRQ',
  videoId: 'JhAzwl6pWq0',
  practiceStart: 0,
  practiceEnd: 64.6,
  madeBy: '홍지윤'
};

export const ONE_LINE_CREDIT = `Clip: ${MOVIE_SETTINGS.titleEn} (${MOVIE_SETTINGS.releaseYear}), ${MOVIE_SETTINGS.distribution} / ${MOVIE_SETTINGS.production} · via YouTube · For educational use only`;

export const EDUCATIONAL_NOTICE_EN =
  'This app was made only for non-commercial English learning in the university course AI and English Language Education (ENG3088, Sungkyunkwan University). The film clip is used only to practice listening and speaking (shadowing). It is not sold, shared for profit, downloaded, or edited. All rights to the film belong to its copyright holders.';

export const EDUCATIONAL_NOTICE_KO =
  '이 앱은 성균관대학교 「인공지능과 영어교육」(ENG3088) 수업의 비영리 영어 학습 목적으로만 제작되었습니다. 영화 장면은 듣기·말하기(쉐도잉) 연습에만 사용하며, 판매·영리적 배포·다운로드·편집을 하지 않습니다. 영화의 모든 권리는 저작권자에게 있습니다.';

export const INITIAL_SENTENCES: Sentence[] = [
  {
    id: 1,
    speaker: 'Joy',
    text: 'Sadness, you nearly touched a core memory!',
    korean: '슬픔아, 너 방금 핵심 기억을 건드릴 뻔했잖아!',
    stress: ['nearly', 'core'],
    start: 6.5,
    end: 8.6
  },
  {
    id: 2,
    speaker: 'Sadness',
    text: "I know, I'm sorry.",
    korean: '알아, 미안해.',
    stress: ['know', 'sorry'],
    start: 11.1,
    end: 12.3
  },
  {
    id: 3,
    speaker: 'Sadness',
    text: "Something's wrong with me.",
    korean: '나한테 뭔가 문제가 있나 봐.',
    stress: ['wrong'],
    start: 12.3,
    end: 14.0
  },
  {
    id: 4,
    speaker: 'Joy',
    text: "You can't focus on what's going wrong.",
    korean: '잘 안 되는 일에만 집중하면 안 돼.',
    stress: ["can't", 'wrong'],
    start: 25.4,
    end: 27.4
  },
  {
    id: 5,
    speaker: 'Joy',
    text: 'Try to think of something funny.',
    korean: '재미있는 걸 생각해 봐.',
    stress: ['try', 'funny'],
    start: 35.8,
    end: 37.5
  },
  {
    id: 6,
    speaker: 'Joy',
    text: 'What are your favorite things to do?',
    korean: '네가 가장 좋아하는 일들은 뭐야?',
    stress: ['favorite', 'things'],
    start: 58.2,
    end: 59.6
  },
  {
    id: 7,
    speaker: 'Sadness',
    text: "Well, I like it when we're outside.",
    korean: '음, 난 우리가 밖에 있을 때가 좋아.',
    stress: ['like', 'outside'],
    start: 61.6,
    end: 63.4
  }
];

export interface StepInfo {
  step: number;
  titleEn: string;
  titleKo: string;
  instructionEn: string;
  instructionKo: string;
  defaultTextHidden: boolean;
}

export const SHADOWING_STEPS: StepInfo[] = [
  {
    step: 1,
    titleEn: 'Step 1 Listen',
    titleKo: '듣기 집중',
    instructionEn: 'Listen 2–3 times without text. Focus on speed and emotion.',
    instructionKo: '자막 없이 2~3회 들으며 배우의 감정과 리듬에 귀 기울여 보세요.',
    defaultTextHidden: true
  },
  {
    step: 2,
    titleEn: 'Step 2 Mumble',
    titleKo: '입속 웅얼거리기',
    instructionEn: 'Quietly murmur along with the sound to loosen your mouth.',
    instructionKo: '소리를 들으며 작게 웅얼웅얼 따라 해 발음 근육을 풀어보세요.',
    defaultTextHidden: true
  },
  {
    step: 3,
    titleEn: 'Step 3 Read & Shadow',
    titleKo: '보며 따라하기',
    instructionEn: 'Read the text and speak out loud together with the clip.',
    instructionKo: '자막을 보면서 영상의 속도와 억양에 맞춰 함께 소리 내어 말해보세요.',
    defaultTextHidden: false
  },
  {
    step: 4,
    titleEn: 'Step 4 Shadow',
    titleKo: '실전 쉐도잉 완성',
    instructionEn: 'Text hidden! Speak simultaneously like a true shadow.',
    instructionKo: '자막 없이 배우의 호흡과 감정까지 완벽히 흉내 내며 쉐도잉을 완성하세요!',
    defaultTextHidden: true
  }
];

export const SELF_CHECK_QUESTIONS = [
  {
    id: 0,
    textEn: 'Did I keep up with the speed?',
    textKo: '속도를 원어민과 비슷하게 잘 맞추었나요?'
  },
  {
    id: 1,
    textEn: 'Did I stress the bold words?',
    textKo: '강조 단어(굵은 글씨)에 강세를 주었나요?'
  },
  {
    id: 2,
    textEn: 'Did my voice go up and down like the actor?',
    textKo: '배우처럼 억양의 오르내림을 살렸나요?'
  }
];
