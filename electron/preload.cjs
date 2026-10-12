const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('classroomCapture', {
  prepare: () => ipcRenderer.invoke('classroom:prepare-board-capture'),
  cancel: () => ipcRenderer.invoke('classroom:cancel-board-capture'),
})
