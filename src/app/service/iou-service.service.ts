import { Injectable } from '@angular/core';
import { DBSchema, IDBPDatabase, openDB } from 'idb';
import { from, Observable } from 'rxjs';

export interface IOU {
  id?: number;
  friend: string;
  amount: number;
  type: 'pay' | 'receive';
  note?: string;
  date: string;
  status: 'pending' | 'cleared';
}

interface IouDB extends DBSchema {
  ious: {
    key: number;
    value: IOU;
  };
}

@Injectable({ providedIn: 'root' })
export class IouServiceService {
  private dbPromise: Promise<IDBPDatabase<IouDB>>;
  constructor() {
    this.dbPromise = openDB<IouDB>('IOU_DB', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('ious')) {
          db.createObjectStore('ious', { keyPath: 'id', autoIncrement: true });
        }
      }
    });
  }
  addIOU(iou: IOU): Observable<number> {
    return from(this.dbPromise.then(db => db.add('ious', iou)));
  }
  getAllIOUs(): Observable<IOU[]> {
    return from(this.dbPromise.then(db => db.getAll('ious')));
  }
  deleteIOU(id: number): Observable<void> {
    return from(this.dbPromise.then(db => db.delete('ious', id)));
  }
  getTotalPayAmount(): Observable<number> {
    return from(this.dbPromise.then(async db => {
      const all = await db.getAll('ious');
      return all.filter(iou => iou.type === 'pay' && iou.status === 'pending').reduce((sum, iou) => sum + iou.amount, 0);
    }));
  }
  getTotalReceiveAmount(): Observable<number> {
    return from(this.dbPromise.then(async db => {
      const all = await db.getAll('ious');
      return all.filter(iou => iou.type === 'receive' && iou.status === 'pending').reduce((sum, iou) => sum + iou.amount, 0);
    }));
  }
  markAsCleared(id: number): Observable<void> {
    return from(this.dbPromise.then(async db => {
      const iou = await db.get('ious', id);
      if (iou) { iou.status = 'cleared'; await db.put('ious', iou); }
    }));
  }
  markAsPending(id: number): Observable<void> {
    return from(this.dbPromise.then(async db => {
      const iou = await db.get('ious', id);
      if (iou) { iou.status = 'pending'; await db.put('ious', iou); }
    }));
  }
  updateIOU(iou: IOU): Observable<void> {
    return from(this.dbPromise.then(async db => { await db.put('ious', iou); }));
  }
  clearMutualIOUs(): Observable<void> {
    return from(this.dbPromise.then(async db => {
      const all = await db.getAll('ious');
      const friends = Array.from(new Set(all.map(iou => iou.friend)));
      for (const friend of friends) {
        const pay = all.filter(iou => iou.friend === friend && iou.type === 'pay' && iou.status === 'pending');
        const receive = all.filter(iou => iou.friend === friend && iou.type === 'receive' && iou.status === 'pending');
        const totalPay = pay.reduce((sum, i) => sum + i.amount, 0);
        const totalReceive = receive.reduce((sum, i) => sum + i.amount, 0);
        const net = totalReceive - totalPay;
        for (const iou of [...pay, ...receive]) { await db.delete('ious', iou.id!); }
        if (net !== 0) {
          const newIou: IOU = {
            friend, amount: Math.abs(net), type: net > 0 ? 'receive' : 'pay',
            date: new Date().toISOString(), status: 'pending',
          };
          await db.add('ious', newIou);
        }
      }
    }));
  }
}
