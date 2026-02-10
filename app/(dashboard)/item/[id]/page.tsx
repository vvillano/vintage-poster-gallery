// Route alias: /item/[id] mirrors /poster/[id] for gradual transition
// Both URLs work: /poster/91 and /item/91
export { default } from '../../poster/[id]/page';
