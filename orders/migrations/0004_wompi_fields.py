from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0003_metodo_pago_pse'),
    ]

    operations = [
        migrations.AddField(
            model_name='pedido',
            name='estado_pago',
            field=models.CharField(
                choices=[
                    ('no_aplica', 'No aplica (efectivo)'),
                    ('pendiente', 'Pendiente'),
                    ('aprobado', 'Aprobado'),
                    ('rechazado', 'Rechazado'),
                ],
                default='no_aplica',
                max_length=12,
                verbose_name='Estado del pago',
            ),
        ),
        migrations.AddField(
            model_name='pedido',
            name='wompi_reference',
            field=models.CharField(blank=True, max_length=80, verbose_name='Referencia Wompi'),
        ),
        migrations.AddField(
            model_name='pedido',
            name='wompi_transaction_id',
            field=models.CharField(blank=True, max_length=120, verbose_name='Transaction ID Wompi'),
        ),
    ]
