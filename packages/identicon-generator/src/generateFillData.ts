import randomSeed from 'random-seed';
import { range } from 'range';

/**
 * Identiconを描く上で必要になる塗りつぶしデータを生成する。
 *
 * @returns `resolution ** 2`ビットの数値。各ビットに塗りつぶすべきかのフラグが表されている。
 */
export const generateFillData = (
  seed: string,
  options: { resolution: number },
): number => {
  /** 描かれるセルの一辺の個数 */
  const resolution = options.resolution;

  /**
   * Identiconは画像の中心を通る垂直な線を軸とする線対称になっているが、
   * このとき左もしくは右には何ピクセル描かれることになるのか
   */
  const sideN = Math.floor(resolution / 2);

  const rand = randomSeed.create(seed);

  /** 左側の塗りつぶしデータ */
  const side = range({ stop: sideN * resolution }).reduce((acc) => {
    return (acc << 1) | (rand(3) === 0 ? 1 : 0);
  }, 0);

  /** 中心の塗りつぶしデータ */
  const center = range({ stop: 1 * resolution }).reduce((acc) => {
    return (acc << 1) | (rand(3) === 0 ? 1 : 0);
  }, 0);

  const data = range({ stop: resolution ** 2 }).reduce((acc, i) => {
    const x = i % resolution;
    const y = Math.floor(i / resolution);

    if (x < sideN) {
      // 現在の座標が描画範囲の左半分なら`side`の値をそのまま使う
      return (acc << 1) | ((side >> (x + y * sideN)) & 1);
    } else if (x > sideN) {
      // 現在の座標が描画範囲の右半分なら`side`の値を使う
      // このとき座標を左右反転させ、鏡像になるようにする
      return (acc << 1) | ((side >> (-x + (resolution - 1) + y * sideN)) & 1);
    } else {
      // 現在の座標が中心軸だった場合は`center`の値をそのまま使う
      return (acc << 1) | ((center >> y) & 1);
    }
  }, 0);

  return data;
};
