// PNG で受け取るキャラ（ペット・ダンジョンの敵）の 3D の原本の置き場所。起こすのは scripts/gen-png-vox.ts。
// ペットは支給の PNG の隣に置く（public/pets/<id>/normal.png と model.vox）。

/** ペットの 3D の原本 */
export const petVoxSrc = (speciesId: string) => `/pets/${speciesId}/model.vox`;
/** 敵の 3D の原本（id は PNG の名前。例: mon-typo） */
export const enemyVoxSrc = (id: string) => `/dungeon/vox/${id}.vox`;
