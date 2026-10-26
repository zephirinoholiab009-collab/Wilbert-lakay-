import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';

import '../../core/order_quote.dart';
import '../../main.dart' show kOrange, kGreen;

class CartItem {
  final String productId;
  final String name;
  final int price; // pou afichaj sèlman; sèvè a itilize pri baz done a
  final int qty;
  const CartItem({
    required this.productId,
    required this.name,
    required this.price,
    required this.qty,
  });
}

class CheckoutScreen extends StatefulWidget {
  final String merchantId;
  final List<CartItem> cart;
  final double lat;
  final double lng;

  const CheckoutScreen({
    super.key,
    required this.merchantId,
    required this.cart,
    required this.lat,
    required this.lng,
  });

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  static const _tipOptions = [0, 25, 50, 100];

  final _placeOrder = FirebaseFunctions.instance.httpsCallable('placeOrder');

  int _tipDriver = 0;
  int _tipMerchant = 0;
  int _tipPlatform = 0;
  String _payment = 'moncash';

  OrderQuote? _quote;
  String? _error;
  bool _loading = false;

  @override
  void initState() {
    super.initState();
    _refreshQuote();
  }

  Map<String, dynamic> _payload({required bool dryRun}) => {
        'merchantId': widget.merchantId,
        'items': [
          for (final i in widget.cart) {'productId': i.productId, 'qty': i.qty}
        ],
        'location': {'lat': widget.lat, 'lng': widget.lng},
        'tips': {
          'driver': _tipDriver,
          'merchant': _tipMerchant,
          'platform': _tipPlatform,
        },
        'paymentMethod': _payment,
        'dryRun': dryRun,
      };

  Future<void> _refreshQuote() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final res = await _placeOrder.call(_payload(dryRun: true));
      if (!mounted) return;
      setState(() => _quote =
          OrderQuote.fromMap(Map<String, dynamic>.from(res.data['quote'])));
    } on FirebaseFunctionsException catch (e) {
      if (!mounted) return;
      setState(() {
        _quote = null;
        _error = e.message ?? 'Erè rive. Eseye ankò.';
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _confirm() async {
    setState(() => _loading = true);
    try {
      final res = await _placeOrder.call(_payload(dryRun: false));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Kòmand voye! (${res.data['orderId']})')),
      );
      Navigator.of(context).maybePop();
    } on FirebaseFunctionsException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message ?? 'Erè rive. Eseye ankò.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = _quote;
    return Scaffold(
      appBar: AppBar(title: const Text('Rezime kòmand lan')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          for (final i in widget.cart)
            _line('${i.qty} × ${i.name}', i.price * i.qty),
          const Divider(height: 32),
          if (q != null) ...[
            _line('Sou-total', q.subtotal),
            _line('Frè livrezon (${q.distanceKm} km)', q.deliveryFee),
            _line('Frè sèvis platfòm', q.serviceFee),
          ],
          const SizedBox(height: 16),
          const Text('Tips (opsyonèl, 100% ale bay moun nan)',
              style: TextStyle(fontWeight: FontWeight.bold)),
          _tipRow('💝 Livrè a', _tipDriver,
              (v) => setState(() => _tipDriver = v)),
          _tipRow('🍽️ Machann lan', _tipMerchant,
              (v) => setState(() => _tipMerchant = v)),
          _tipRow('💙 Wilbert Lakay', _tipPlatform,
              (v) => setState(() => _tipPlatform = v)),
          const Divider(height: 32),
          const Text('Peman', style: TextStyle(fontWeight: FontWeight.bold)),
          for (final opt in const [
            ['moncash', 'MonCash'],
            ['natcash', 'NatCash'],
            ['cash', 'Cash a la livrezon'],
          ])
            RadioListTile<String>(
              title: Text(opt[1]),
              value: opt[0],
              // ignore: deprecated_member_use
              groupValue: _payment,
              // ignore: deprecated_member_use
              onChanged: (v) {
                setState(() => _payment = v!);
                _refreshQuote();
              },
            ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Text(_error!, style: const TextStyle(color: Colors.red)),
            ),
          const SizedBox(height: 8),
          if (q != null) _line('TOTAL', q.total, bold: true),
          const SizedBox(height: 16),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: kGreen, minimumSize: const Size.fromHeight(52)),
            onPressed: (_loading || q == null) ? null : _confirm,
            child: _loading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Konfime kòmand lan'),
          ),
        ],
      ),
    );
  }

  Widget _line(String label, int amount, {bool bold = false}) {
    final style = TextStyle(
      fontWeight: bold ? FontWeight.bold : FontWeight.normal,
      fontSize: bold ? 18 : 14,
      color: bold ? kOrange : null,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [Text(label, style: style), Text('$amount HTG', style: style)],
      ),
    );
  }

  Widget _tipRow(String label, int value, ValueChanged<int> onChanged) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(children: [
        Expanded(child: Text(label)),
        Wrap(spacing: 6, children: [
          for (final t in _tipOptions)
            ChoiceChip(
              label: Text('$t'),
              selected: value == t,
              onSelected: (_) {
                onChanged(t);
                _refreshQuote();
              },
            ),
        ]),
      ]),
    );
  }
}
