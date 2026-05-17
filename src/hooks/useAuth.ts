// 从全局 AuthContext 重新导出，所有组件 import useAuth 时共享同一份状态
export { useAuth } from '../context/AuthContext';
export type { } from '../context/AuthContext';
