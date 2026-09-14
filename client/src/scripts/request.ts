import axios, { AxiosError, AxiosHeaders } from 'axios'
import { Ref } from 'vue'
import { BamblooStatusCode, ResponsePacket } from '../../../common/status'

// type ResponseCallback = (packet: ResponsePacket) => unknown

// let global_error_callback: ResponseCallback

// export function onError(callback: ResponseCallback) {
//   global_error_callback = callback
// }

export function post(
  url: string,
  loading: Ref<boolean>,
  data?: Buffer | { [key: string]: unknown },
  headers?: AxiosHeaders,
  raw?: Buffer,
): Promise<ResponsePacket> {
  loading.value = true
  return axios(url, {
    method: 'post',
    data: data,
    headers: headers,
    responseType: raw ? 'blob' : 'json',
  })
    .then((response) => {
      loading.value = false
      if (raw) {
        // console.log(response.data)
        return response.data
      }
      const data = response.data as ResponsePacket
      if (data.code == BamblooStatusCode.Success) {
        return data
      } else {
        throw data
      }
    })
    .catch((err) => {
      loading.value = false
      console.log(err)
      if (err instanceof AxiosError) {
        throw { code: BamblooStatusCode.NetworkInvalid, msg: err.message }
      } else {
        throw err
      }
    })
}
