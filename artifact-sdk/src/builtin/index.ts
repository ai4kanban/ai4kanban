// 内置组件的清单，与第三方的 wildcrane.component.json 同一写法。
import compare from './compare.json';
import html from './html.json';
import image from './image.json';
import markdown from './markdown.json';
import spritesheet from './spritesheet.json';
import storyboard from './storyboard.json';
import tiled from './tiled.json';
import video from './video.json';
import workflow from './workflow.json';

// akb 的打包把 JSON 当文本读入。
const read = (m: unknown): unknown => (typeof m === 'string' ? JSON.parse(m) : m);

export default [html, image, video, markdown, storyboard, compare, workflow, tiled, spritesheet].map(read);
