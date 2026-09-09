export class Mutex {
  owners: ((obj: void) => void)[] = []

  do<ReturnType>(callback: () => Promise<ReturnType> | ReturnType): Promise<ReturnType> {
    return new Promise<void>((resolve) => {
      if (!this.owners.length) {
        resolve()
      }
      this.owners.push(resolve)
    })
      .then(() => {
        return callback()
      })
      .finally(() => {
        this.owners.shift()
        if (this.owners.length) {
          this.owners[0]()
        }
      })
  }
}
